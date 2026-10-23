import 'server-only';
import { verifyDraftEvidence, type ResumeDraft } from '@/features/resume/lib/draft';
import type { ResumeEvent, ResumeRequest } from '@/features/resume/lib/schema';
import { findCommits, summarizeWorkAreas } from './analysis';

/**
 * 가짜 응답 모드. Claude를 부르지 않고 미리 정한 틀의 초안을 스트리밍한다.
 * - RESUME_MOCK=1 이면 항상
 * - API 키가 없고 개발 환경이면 자동으로 (운영에서 키를 빠뜨렸을 때 가짜 초안이 나가지 않도록 production은 제외)
 */
export function isResumeMockMode(): boolean {
  if (process.env.RESUME_MOCK === '1') return true;
  return !process.env.ANTHROPIC_API_KEY && process.env.NODE_ENV !== 'production';
}

/** 단계 사이 대기 시간. 실제 Claude보다 훨씬 짧게 둔다. */
const STEP_DELAY_MS = 700;
const CHUNK_DELAY_MS = 25;
const CHUNK_SIZE = 12;

const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' });

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/**
 * 실제로 보낸 커밋의 해시·기간으로 초안 틀을 채운다. 문장은 고정 문구다.
 * 근거 확인 화면을 시험할 수 있도록 마지막 문장에는 목록에 없는 해시를 하나 섞는다(검증 단계에서 빠진다).
 */
function buildMockDraft({ projectName, commits }: ResumeRequest): ResumeDraft {
  const sorted = [...commits].sort((a, b) => Date.parse(a.authoredAt) - Date.parse(b.authoredAt));
  const shas = sorted.map(commit => commit.sha.slice(0, 7));
  const first = dateFormatter.format(new Date(sorted[0].authoredAt));
  const last = dateFormatter.format(new Date(sorted[sorted.length - 1].authoredAt));
  // 커밋을 세 묶음으로 나눠 성과마다 근거로 붙인다.
  const groups = [0, 1, 2]
    .map(i => shas.filter((_, index) => index % 3 === i).slice(0, 3))
    .filter(group => group.length > 0);

  return {
    summary: {
      overview: `(가짜) ${projectName}에서 커밋 ${sorted.length}개로 기능을 만들고 다듬음`,
      period: `${first} ~ ${last}`,
      role: '[역할]',
      techStack: ['[기술]'],
    },
    achievements: groups.map((group, index) => ({
      title: `(가짜) 성과 ${index + 1}`,
      sentences: [
        { kind: 'problem', text: '[문제를 적어 주세요]', evidence: group.slice(0, 1) },
        { kind: 'solution', text: `커밋 ${group.length}개에 걸쳐 기능을 구현하고 정리`, evidence: group },
        {
          kind: 'result',
          text: '응답 시간 [N]% 개선',
          evidence: index === groups.length - 1 ? ['0000000'] : group.slice(-1),
        },
      ],
    })),
  };
}

/**
 * streamResumeDraft와 같은 순서로 이벤트를 내보낸다 (받기 → 생각 → 도구 → 생각 → 도구 → 쓰기).
 * 단계 설명의 숫자는 실제 분석 함수로 계산한 값이다.
 */
export async function* streamMockResumeDraft(input: ResumeRequest, signal: AbortSignal): AsyncGenerator<ResumeEvent> {
  const draft = buildMockDraft(input);
  const json = JSON.stringify(draft);
  const areas = summarizeWorkAreas(input.commits, 2, 20);
  const shas = input.commits.slice(0, 5).map(commit => commit.sha.slice(0, 7));
  const { found } = findCommits(input.commits, shas);
  const fileCount = found.reduce((sum, commit) => sum + (commit.lineStats?.files.length ?? 0), 0);

  yield { type: 'step', id: 'received', label: '커밋 받기', status: 'done', detail: `내 커밋 ${input.commits.length}개` };

  const steps: { id: string; label: string; detail?: string }[] = [
    { id: 'think-0', label: '커밋을 읽고 분석 방향 잡기' },
    {
      id: 'mock-areas',
      label: '작업 영역 살펴보기',
      detail: areas.length > 0 ? `폴더 ${areas.length}곳 · 가장 많이 바꾼 곳 ${areas[0].area}` : '파일 정보 없음',
    },
    { id: 'think-1', label: '확인한 내용 정리하기' },
    {
      id: 'mock-files',
      label: shas.length > 1 ? `커밋 ${shas[0]} 외 ${shas.length - 1}개의 변경 파일 확인` : `커밋 ${shas[0]}의 변경 파일 확인`,
      detail: `파일 ${fileCount}개`,
    },
    { id: 'think-2', label: '확인한 내용 정리하기' },
  ];
  for (const step of steps) {
    yield { type: 'step', id: step.id, label: step.label, status: 'running' };
    await sleep(STEP_DELAY_MS, signal);
    yield { type: 'step', id: step.id, label: step.label, status: 'done', detail: step.detail };
  }

  yield { type: 'step', id: 'write', label: '초안 쓰기', status: 'running' };
  for (let i = 0; i < json.length; i += CHUNK_SIZE) {
    yield { type: 'text', text: json.slice(i, i + CHUNK_SIZE) };
    await sleep(CHUNK_DELAY_MS, signal);
  }
  yield { type: 'step', id: 'write', label: '초안 쓰기', status: 'done' };
  yield {
    type: 'done',
    draft: verifyDraftEvidence(draft, input.commits.map(commit => commit.sha)),
    stopReason: 'end_turn',
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
  };
}
