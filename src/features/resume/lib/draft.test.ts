import { describe, expect, it } from 'vitest';
import { verifyDraftEvidence, type ResumeDraft } from './draft';
import { parsePartialDraft } from './partialDraft';
import { acceptAllPending, countBlanks, countReview, draftToMarkdown, keptAchievements, type DraftReview } from './review';

const COMMITS = ['bdc87a4' + '0'.repeat(33), '42900d2' + '1'.repeat(33), '6daeb92' + '2'.repeat(33)];

const draft: ResumeDraft = {
  summary: { overview: '한 줄 소개', period: '2026-10 ~ 2026-10', role: '[역할]', techStack: ['Next.js', 'Zod'] },
  achievements: [
    {
      title: '로그인 구현',
      sentences: [
        { kind: 'problem', text: '토큰을 안전하게 보관해야 함', evidence: ['bdc87a4'] },
        { kind: 'solution', text: 'JWE 쿠키 세션 구현', evidence: ['bdc87a4', '42900d2'] },
        { kind: 'result', text: '재로그인 [N]% 감소', evidence: ['bdc87a4'] },
      ],
    },
    {
      title: '기여 분석',
      sentences: [{ kind: 'solution', text: 'lockfile 제외 집계', evidence: ['6daeb92'] }],
    },
  ],
};

describe('verifyDraftEvidence', () => {
  it('목록에 없는 해시는 빼고, 길거나 대문자인 해시는 7자 소문자로 맞추고, 중복을 없앤다', () => {
    const input: ResumeDraft = {
      ...draft,
      achievements: [
        {
          title: 't',
          sentences: [
            { kind: 'solution', text: 's', evidence: ['BDC87A4000', 'bdc87a4', 'deadbee', 'abc'] },
            { kind: 'result', text: 'r', evidence: ['0000000'] },
          ],
        },
      ],
    };
    const [achievement] = verifyDraftEvidence(input, COMMITS).achievements;

    expect(achievement.sentences[0].evidence).toEqual(['bdc87a4']);
    // 근거가 하나도 남지 않으면 빈 배열 (화면에서 "근거 없음")
    expect(achievement.sentences[1].evidence).toEqual([]);
  });
});

describe('검토 상태', () => {
  const review: DraftReview = {
    '0-0': { status: 'accepted' },
    '0-1': { status: 'edited', text: 'JWE 암호화 쿠키 세션 구현' },
    '0-2': { status: 'rejected' },
  };

  it('수락·수정·거절·남은 문장 수를 센다', () => {
    expect(countReview(draft, review)).toEqual({ accepted: 1, edited: 1, rejected: 1, pending: 1 });
  });

  it('남은 문장만 모두 수락하고 수정·거절한 문장은 그대로 둔다', () => {
    const next = acceptAllPending(draft, review);
    expect(next['1-0']).toEqual({ status: 'accepted' });
    expect(next['0-1']).toEqual(review['0-1']);
    expect(next['0-2']).toEqual({ status: 'rejected' });
  });

  it('수락·수정한 문장만 남기고, 남은 문장이 없는 성과는 뺀다', () => {
    const kept = keptAchievements(draft, review);
    expect(kept).toHaveLength(1);
    expect(kept[0].sentences.map(sentence => sentence.text)).toEqual(['토큰을 안전하게 보관해야 함', 'JWE 암호화 쿠키 세션 구현']);
  });

  it('[N]·[역할] 같은 빈칸을 센다', () => {
    expect(countBlanks(['재로그인 [N]% 감소', '[역할] 담당, [N]명', '빈칸 없음'])).toBe(3);
  });

  it('마크다운에는 수락·수정한 문장만 근거와 함께 넣고, 남은 문장이 없는 성과는 뺀다', () => {
    expect(draftToMarkdown('shipped', draft, review)).toBe(
      [
        '## shipped',
        '한 줄 소개',
        '',
        '- 기간: 2026-10 ~ 2026-10',
        '- 역할: [역할]',
        '- 기술: Next.js, Zod',
        '',
        '### 로그인 구현',
        '- 문제: 토큰을 안전하게 보관해야 함 (근거: bdc87a4)',
        '- 해결: JWE 암호화 쿠키 세션 구현 (근거: bdc87a4, 42900d2)',
      ].join('\n'),
    );
  });
});

describe('parsePartialDraft', () => {
  const full = JSON.stringify(draft);

  it('JSON이 시작되기 전에는 null', () => {
    expect(parsePartialDraft('')).toBeNull();
    expect(parsePartialDraft('  ')).toBeNull();
  });

  it('잘린 JSON에서 다 쓴 필드까지 읽는다', () => {
    const cut = full.slice(0, full.indexOf('JWE 쿠키 세션') + 3);
    const partial = parsePartialDraft(cut);

    expect(partial?.summary.techStack).toEqual(['Next.js', 'Zod']);
    expect(partial?.achievements[0].title).toBe('로그인 구현');
    expect(partial?.achievements[0].sentences[0]).toMatchObject({ kind: 'problem', text: '토큰을 안전하게 보관해야 함' });
  });

  it('완성된 JSON은 원래 초안과 같다', () => {
    expect(parsePartialDraft(full)).toEqual(draft);
  });
});
