import { describe, expect, it } from 'vitest';
import { summarizeContribution, type ContributionCommit } from './contribution';
import { isLockfile } from './excluded-files';

function commit(sha: string, authoredAt: string, lineStats: ContributionCommit['lineStats']): ContributionCommit {
  return { sha, headline: sha, message: sha, authoredAt, url: null, lineStats };
}

const stats = (additions: number, deletions: number) => ({ additions, deletions, changedFiles: 1, files: [] });

describe('summarizeContribution', () => {
  it('기간·변경 줄 수·월별 활동을 요약한다', () => {
    const summary = summarizeContribution([
      commit('b', '2026-03-10T10:00:00+09:00', stats(5, 1)),
      commit('a', '2026-01-02T10:00:00+09:00', stats(10, 2)),
      commit('c', '2026-03-20T10:00:00+09:00', stats(1, 0)),
    ]);

    expect(summary).toEqual({
      commitCount: 3,
      firstAt: '2026-01-02T10:00:00+09:00',
      lastAt: '2026-03-20T10:00:00+09:00',
      lineTotals: { additions: 16, deletions: 3 },
      monthly: [
        { month: '2026-01', count: 1 },
        { month: '2026-03', count: 2 },
      ],
    });
  });

  it('작성자 시간대 기준으로 달을 나눈다 (서버 시간대와 무관)', () => {
    // UTC로는 1월 31일이지만 작성자(+09:00) 기준으로는 2월 1일
    const summary = summarizeContribution([commit('a', '2026-02-01T08:00:00+09:00', stats(1, 0))]);
    expect(summary.monthly).toEqual([{ month: '2026-02', count: 1 }]);
  });

  it('줄 수를 아직 세는 커밋이 있으면 합계는 null', () => {
    const summary = summarizeContribution([
      commit('a', '2026-01-02T10:00:00+09:00', stats(1, 0)),
      commit('b', '2026-01-03T10:00:00+09:00', null),
    ]);
    expect(summary.lineTotals).toBeNull();
  });

  it('커밋이 없으면 비어 있는 요약', () => {
    expect(summarizeContribution([])).toEqual({
      commitCount: 0,
      firstAt: null,
      lastAt: null,
      lineTotals: { additions: 0, deletions: 0 },
      monthly: [],
    });
  });
});

describe('isLockfile', () => {
  it.each(['package-lock.json', 'apps/web/pnpm-lock.yaml', 'yarn.lock', 'Cargo.lock', 'go.sum'])('%s는 lockfile', path => {
    expect(isLockfile(path)).toBe(true);
  });

  it.each(['package.json', 'src/lock.ts', 'docs/yarn.lock.md'])('%s는 lockfile이 아니다', path => {
    expect(isLockfile(path)).toBe(false);
  });
});
