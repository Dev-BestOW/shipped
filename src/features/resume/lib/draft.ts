import { z } from 'zod';

/**
 * 경력기술서 초안의 구조. Claude가 이 형태의 JSON으로 답하도록 강제한다(structured outputs).
 * 길이·개수 제약은 structured outputs가 지원하지 않아 프롬프트로 안내한다.
 */
export const resumeDraftSchema = z.object({
  summary: z.object({
    overview: z.string().describe('프로젝트와 사용자가 맡은 일을 한 문장으로'),
    period: z.string().describe('기간. 예: 2026-03 ~ 2026-10'),
    role: z.string().describe('역할. 커밋으로 알 수 없으면 [역할]'),
    techStack: z.array(z.string()).describe('커밋 메시지·파일 경로에서 확인한 기술만'),
  }),
  achievements: z
    .array(
      z.object({
        title: z.string().describe('성과 제목 한 줄'),
        sentences: z
          .array(
            z.object({
              kind: z.enum(['problem', 'solution', 'result']),
              text: z.string().describe('이력서 문체 한 문장. 근거 없는 수치는 [N]'),
              evidence: z.array(z.string()).describe('이 문장의 근거 커밋 짧은 해시(7자)'),
            }),
          )
          .describe('problem → solution → result 순서'),
      }),
    )
    .describe('성과 3~5개'),
});

export type ResumeDraft = z.infer<typeof resumeDraftSchema>;
export type DraftSentence = ResumeDraft['achievements'][number]['sentences'][number];

export const SENTENCE_KIND_LABEL: Record<DraftSentence['kind'], string> = {
  problem: '문제',
  solution: '해결',
  result: '결과',
};

/**
 * 근거 해시를 실제로 보낸 커밋과 맞춰 본다. 없는 해시는 빼고 7자로 맞춘다.
 * 근거가 하나도 남지 않은 문장은 화면에서 "근거 없음"으로 보인다.
 */
export function verifyDraftEvidence(draft: ResumeDraft, commitShas: readonly string[]): ResumeDraft {
  const resolve = (sha: string) => commitShas.find(full => full.startsWith(sha.trim().toLowerCase()));
  return {
    ...draft,
    achievements: draft.achievements.map(achievement => ({
      ...achievement,
      sentences: achievement.sentences.map(sentence => ({
        ...sentence,
        evidence: [
          ...new Set(
            sentence.evidence.flatMap(sha => {
              const full = sha.length >= 7 ? resolve(sha) : undefined;
              return full ? [full.slice(0, 7)] : [];
            }),
          ),
        ],
      })),
    })),
  };
}
