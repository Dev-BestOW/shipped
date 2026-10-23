import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { ResumeEvent, ResumeRequest } from '@/features/resume/lib/schema';
import { buildResumeUserContent, RESUME_SYSTEM_PROMPT } from './prompt';
import { createResumeTools, runningLabelForTool } from './tools';

const MODEL = 'claude-opus-5-5';
/** 도구를 부르고 다시 생각하는 왕복의 상한. 보통 3~4번이면 끝난다. */
const MAX_ITERATIONS = 8;

type StepEvent = Extract<ResumeEvent, { type: 'step' }>;

let client: Anthropic | undefined;

/** ANTHROPIC_API_KEY는 SDK가 환경 변수에서 직접 읽는다. */
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

/**
 * 경력기술서 초안을 스트리밍으로 생성한다. Claude가 분석 도구를 부르는 과정을 단계(step)로,
 * 최종 초안을 텍스트로 내보낸다. signal이 취소되면(사용자가 멈춤·페이지 이탈) 요청도 끊는다.
 */
export async function* streamResumeDraft(input: ResumeRequest, signal: AbortSignal): AsyncGenerator<ResumeEvent> {
  // 도구는 툴 러너가 다음 요청 전에 실행하므로, 그 사이에 쌓인 단계를 반복마다 내보낸다.
  const pendingSteps: StepEvent[] = [];
  const tools = createResumeTools(input, step => pendingSteps.push(step));

  yield {
    type: 'step',
    id: 'received',
    label: '커밋 받기',
    status: 'done',
    detail: `내 커밋 ${input.commits.length}개`,
  };

  const runner = getClient().beta.messages.toolRunner(
    {
      model: MODEL,
      max_tokens: 64000,
      // 문장 품질이 중요한 작업이라 기본값(medium)보다 한 단계 높인다.
      output_config: { effort: 'high' },
      // 안전 분류기가 거절하면 Anthropic이 권장하는 모델로 서버에서 다시 시도한다.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // 같은 커밋으로 다시 생성하거나 도구 왕복으로 다시 보낼 때 입력을 캐시에서 읽는다.
      cache_control: { type: 'ephemeral' },
      system: RESUME_SYSTEM_PROMPT,
      tools,
      max_iterations: MAX_ITERATIONS,
      messages: [{ role: 'user', content: buildResumeUserContent(input) }],
      stream: true,
    },
    { signal },
  );

  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  let stopReason: Extract<ResumeEvent, { type: 'done' }>['stopReason'] = 'other';
  let writing = false;
  let iteration = 0;

  for await (const messageStream of runner) {
    yield* pendingSteps.splice(0);

    const thinkId = `think-${iteration}`;
    const thinkLabel = iteration === 0 ? '커밋을 읽고 분석 방향 잡기' : '확인한 내용 정리하기';
    let thinking = true;
    yield { type: 'step', id: thinkId, label: thinkLabel, status: 'running' };
    const finishThinking = (): StepEvent | null => {
      if (!thinking) return null;
      thinking = false;
      return { type: 'step', id: thinkId, label: thinkLabel, status: 'done' };
    };

    for await (const event of messageStream) {
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        const done = finishThinking();
        if (done) yield done;
        yield { type: 'step', id: event.content_block.id, label: runningLabelForTool(event.content_block.name), status: 'running' };
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const done = finishThinking();
        if (done) yield done;
        if (!writing) {
          writing = true;
          yield { type: 'step', id: 'write', label: '초안 쓰기', status: 'running' };
        }
        yield { type: 'text', text: event.delta.text };
      }
    }

    const message = await messageStream.finalMessage();
    const done = finishThinking();
    if (done) yield done;
    usage.inputTokens += message.usage.input_tokens;
    usage.outputTokens += message.usage.output_tokens;
    usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;

    if (message.stop_reason === 'refusal') {
      yield { type: 'error', message: 'Claude가 이 요청을 처리하지 않았어요. 커밋 내용을 확인한 뒤 다시 시도해 주세요.' };
      return;
    }
    // 도구 입력이 잘린 채 실행되지 않도록 멈춘다.
    if (message.stop_reason === 'max_tokens' && message.content.some(block => block.type === 'tool_use')) {
      yield { type: 'error', message: '분석 중 응답이 너무 길어져 멈췄어요. 다시 시도해 주세요.' };
      return;
    }
    stopReason = message.stop_reason === 'end_turn' || message.stop_reason === 'max_tokens' ? message.stop_reason : 'other';
    iteration++;
  }

  yield* pendingSteps.splice(0);
  // 도구 왕복이 상한에 걸려 초안을 쓰기 전에 끝났다.
  if (!writing) {
    yield { type: 'error', message: '분석이 길어져 초안을 쓰지 못했어요. 다시 시도해 주세요.' };
    return;
  }
  yield { type: 'step', id: 'write', label: '초안 쓰기', status: 'done' };
  yield { type: 'done', stopReason, usage };
}

/** Claude 오류를 사용자에게 보여 줄 문구로 바꾼다. */
export function describeResumeError(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError) return '요청이 많아 잠시 막혔어요. 1분쯤 뒤에 다시 시도해 주세요.';
  if (error instanceof Anthropic.AuthenticationError) return '서버의 Claude API 키가 올바르지 않아요.';
  if (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500) {
    return 'Claude 서버에 일시적인 문제가 있어요. 잠시 후 다시 시도해 주세요.';
  }
  return '초안을 만드는 중 문제가 생겼어요. 다시 시도해 주세요.';
}
