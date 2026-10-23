import { SENTENCE_KIND_LABEL, type ResumeDraft } from './draft';

/** 문장 하나의 검토 결과. 수정한 문장은 고친 글을 함께 둔다. */
export type SentenceReview =
  | { status: 'pending' }
  | { status: 'accepted' }
  | { status: 'edited'; text: string }
  | { status: 'rejected' };

/** 키: `${성과 번호}-${문장 번호}` */
export type DraftReview = Record<string, SentenceReview>;

export function sentenceKey(achievementIndex: number, sentenceIndex: number): string {
  return `${achievementIndex}-${sentenceIndex}`;
}

export function getReview(review: DraftReview, key: string): SentenceReview {
  return review[key] ?? { status: 'pending' };
}

export function countReview(draft: ResumeDraft, review: DraftReview) {
  const counts = { pending: 0, accepted: 0, edited: 0, rejected: 0 };
  draft.achievements.forEach((achievement, a) =>
    achievement.sentences.forEach((_, s) => {
      counts[getReview(review, sentenceKey(a, s)).status]++;
    }),
  );
  return counts;
}

/** 아직 검토하지 않은 문장을 모두 수락한다. 이미 수정·거절한 문장은 그대로 둔다. */
export function acceptAllPending(draft: ResumeDraft, review: DraftReview): DraftReview {
  const next = { ...review };
  draft.achievements.forEach((achievement, a) =>
    achievement.sentences.forEach((_, s) => {
      const key = sentenceKey(a, s);
      if (getReview(next, key).status === 'pending') next[key] = { status: 'accepted' };
    }),
  );
  return next;
}

/** 수락·수정한 문장만 남긴 성과 목록. 남은 문장이 없는 성과는 뺀다. 마크다운·PDF가 같이 쓴다. */
export function keptAchievements(draft: ResumeDraft, review: DraftReview) {
  return draft.achievements.flatMap((achievement, a) => {
    const sentences = achievement.sentences.flatMap((sentence, s) => {
      const result = getReview(review, sentenceKey(a, s));
      if (result.status === 'accepted') return [sentence];
      if (result.status === 'edited') return [{ ...sentence, text: result.text }];
      return [];
    });
    return sentences.length > 0 ? [{ title: achievement.title, sentences }] : [];
  });
}

/** 사용자가 채워야 할 빈칸([N], [역할] 등) 개수 */
export function countBlanks(texts: readonly string[]): number {
  return texts.reduce((sum, text) => sum + (text.match(/\[[^\]]+\]/g)?.length ?? 0), 0);
}

/**
 * 수락·수정한 문장만 마크다운으로 만든다.
 * 근거 커밋은 사용자가 출처를 확인할 수 있도록 문장 끝에 붙인다.
 */
export function draftToMarkdown(projectName: string, draft: ResumeDraft, review: DraftReview): string {
  const { summary } = draft;
  const lines = [
    `## ${projectName}`,
    summary.overview,
    '',
    `- 기간: ${summary.period}`,
    `- 역할: ${summary.role}`,
    summary.techStack.length > 0 ? `- 기술: ${summary.techStack.join(', ')}` : null,
  ].filter((line): line is string => line !== null);

  for (const achievement of keptAchievements(draft, review)) {
    lines.push('', `### ${achievement.title}`);
    for (const sentence of achievement.sentences) {
      const evidence = sentence.evidence.length > 0 ? ` (근거: ${sentence.evidence.join(', ')})` : '';
      lines.push(`- ${SENTENCE_KIND_LABEL[sentence.kind]}: ${sentence.text}${evidence}`);
    }
  }

  return lines.join('\n');
}
