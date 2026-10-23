/** 커밋 하나에서 바뀐 파일. 경로와 줄 수만 담고 코드 내용은 담지 않는다. */
export type CommitFile = {
  path: string;
  additions: number;
  deletions: number;
};

/** 커밋 하나에 담는 파일 수 상한. 넘으면 앞쪽만 담고 changedFiles에 실제 수를 남긴다. */
export const MAX_FILES_PER_COMMIT = 300;

/** 변경 줄 수와 파일. lockfile은 뺀다 (excluded-files.ts) */
export type LineStats = {
  additions: number;
  deletions: number;
  changedFiles: number;
  files: CommitFile[];
};

/**
 * 본인 커밋 하나. GitHub API와 로컬 git log 업로드 모두 이 형태로 맞춘다.
 * 이후 단계에서 경력기술서 문장의 근거로 연결된다.
 */
export type ContributionCommit = {
  sha: string;
  /** 커밋 메시지 첫 줄 */
  headline: string;
  /** 커밋 메시지 전체 */
  message: string;
  /** 작성 시각. 작성자의 시간대 오프셋이 포함된 ISO 8601 문자열 */
  authoredAt: string;
  /** GitHub 커밋 페이지 주소. 로컬 업로드는 null */
  url: string | null;
  /** 아직 세는 중이면 null. GitHub는 커밋 목록보다 늦게 채워진다. */
  lineStats: LineStats | null;
};

export type MonthlyCount = {
  /** YYYY-MM (작성자 시간대 기준) */
  month: string;
  count: number;
};

export type ContributionSummary = {
  commitCount: number;
  firstAt: string | null;
  lastAt: string | null;
  /** 커밋 하나라도 줄 수를 아직 세는 중이면 null */
  lineTotals: Pick<LineStats, 'additions' | 'deletions'> | null;
  /** 커밋이 있었던 달만, 오래된 순 */
  monthly: MonthlyCount[];
};

/** 커밋 목록을 기간·규모·월별 활동으로 요약한다. */
export function summarizeContribution(commits: readonly ContributionCommit[]): ContributionSummary {
  const sorted = [...commits].sort((a, b) => Date.parse(a.authoredAt) - Date.parse(b.authoredAt));
  const monthly = new Map<string, number>();
  let lineTotals: ContributionSummary['lineTotals'] = { additions: 0, deletions: 0 };

  for (const commit of sorted) {
    if (lineTotals && commit.lineStats) {
      lineTotals.additions += commit.lineStats.additions;
      lineTotals.deletions += commit.lineStats.deletions;
    } else {
      lineTotals = null;
    }
    // 서버와 브라우저의 시간대 차이로 결과가 달라지지 않도록 작성자 시각 그대로 자른다.
    const month = commit.authoredAt.slice(0, 7);
    monthly.set(month, (monthly.get(month) ?? 0) + 1);
  }

  return {
    commitCount: sorted.length,
    firstAt: sorted.at(0)?.authoredAt ?? null,
    lastAt: sorted.at(-1)?.authoredAt ?? null,
    lineTotals,
    monthly: [...monthly]
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}
