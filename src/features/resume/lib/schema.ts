import { z } from 'zod';
import { MAX_FILES_PER_COMMIT } from '@/features/repos/lib/contribution';
import { resumeDraftSchema } from './draft';

/** 한 번에 보낼 수 있는 최대 커밋 수. GitHub 수집 상한(500개)과 맞춘다. */
export const MAX_RESUME_COMMITS = 500;

const lineStatsSchema = z.object({
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  changedFiles: z.number().int().nonnegative(),
  /** 경로와 줄 수만. 분석 도구(get_commit_files 등)가 읽는다. */
  files: z
    .array(
      z.object({
        path: z.string().max(1000),
        additions: z.number().int().nonnegative(),
        deletions: z.number().int().nonnegative(),
      }),
    )
    .max(MAX_FILES_PER_COMMIT),
});

/**
 * 경력기술서 생성 요청. 브라우저가 이미 가진 본인 커밋을 보낸다(GitHub·로컬 업로드 공통).
 * 서버는 저장하지 않고 Claude에 보낼 프롬프트를 만드는 데만 쓴다.
 */
export const resumeRequestSchema = z.object({
  projectName: z.string().trim().min(1).max(200),
  commits: z
    .array(
      z.object({
        sha: z.string().regex(/^[0-9a-f]{7,64}$/),
        message: z.string().max(5000),
        authoredAt: z.iso.datetime({ offset: true }),
        lineStats: lineStatsSchema.nullable(),
      }),
    )
    .min(1)
    .max(MAX_RESUME_COMMITS),
  /** 레포 전체 커밋 중 내 커밋 수. 알 수 없으면 생략 */
  share: z.object({ mine: z.number().int().nonnegative(), total: z.number().int().positive() }).optional(),
});

export type ResumeRequest = z.infer<typeof resumeRequestSchema>;

/** 응답은 한 줄에 이벤트 하나씩인 NDJSON 스트림이다. */
export const resumeEventSchema = z.discriminatedUnion('type', [
  /** 맨 처음 한 번. mock이면 Claude 대신 개발용 가짜 응답이다. */
  z.object({ type: z.literal('start'), mock: z.boolean() }),
  /**
   * 분석 단계. 같은 id로 여러 번 오면 갱신한다(running → done).
   * label은 단계 이름, detail은 끝난 뒤 결과 요약이다.
   */
  z.object({
    type: z.literal('step'),
    id: z.string(),
    label: z.string(),
    status: z.enum(['running', 'done']),
    detail: z.string().optional(),
  }),
  /** 초안 JSON 조각. 브라우저가 이어 붙여 덜 완성된 JSON으로 읽는다. */
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({
    type: z.literal('done'),
    /** 스키마 검증과 근거 커밋 확인을 마친 최종 초안 */
    draft: resumeDraftSchema,
    /** max_tokens면 글이 중간에 끊겼다는 뜻 */
    stopReason: z.enum(['end_turn', 'max_tokens', 'other']),
    usage: z.object({ inputTokens: z.number(), outputTokens: z.number(), cacheReadTokens: z.number() }),
  }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);

export type ResumeEvent = z.infer<typeof resumeEventSchema>;
