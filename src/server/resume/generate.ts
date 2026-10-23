import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { ResumeEvent, ResumeRequest } from '@/features/resume/lib/schema';
import { buildResumeUserContent, RESUME_SYSTEM_PROMPT } from './prompt';

const MODEL = 'claude-opus-5-5';

let client: Anthropic | undefined;

/** ANTHROPIC_API_KEY는 SDK가 환경 변수에서 직접 읽는다. */
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

/**
 * 경력기술서 초안을 스트리밍으로 생성한다. Claude 응답을 화면용 이벤트로 바꿔 내보낸다.
 * signal이 취소되면(사용자가 멈춤·페이지 이탈) 요청도 끊는다.
 */
export async function* streamResumeDraft(input: ResumeRequest, signal: AbortSignal): AsyncGenerator<ResumeEvent> {
  const stream = getClient().beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 64000,
      // 문장 품질이 중요한 작업이라 기본값(medium)보다 한 단계 높인다.
      output_config: { effort: 'high' },
      // 안전 분류기가 거절하면 Anthropic이 권장하는 모델로 서버에서 다시 시도한다.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // 같은 커밋으로 다시 생성할 때 입력을 캐시에서 읽는다.
      cache_control: { type: 'ephemeral' },
      system: RESUME_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildResumeUserContent(input) }],
    },
    { signal },
  );

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield { type: 'text', text: event.delta.text };
    }
  }

  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') {
    yield { type: 'error', message: 'Claude가 이 요청을 처리하지 않았어요. 커밋 내용을 확인한 뒤 다시 시도해 주세요.' };
    return;
  }

  yield {
    type: 'done',
    stopReason:
      message.stop_reason === 'end_turn' || message.stop_reason === 'max_tokens' ? message.stop_reason : 'other',
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    },
  };
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
