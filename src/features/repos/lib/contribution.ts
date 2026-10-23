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
  additions: number;
  deletions: number;
  /** GitHub가 큰 커밋에서 파일 수를 계산하지 않으면 null */
  changedFiles: number | null;
  /** GitHub 커밋 페이지 주소. 로컬 업로드는 null */
  url: string | null;
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
  additions: number;
  deletions: number;
  /** 커밋이 있었던 달만, 오래된 순 */
  monthly: MonthlyCount[];
};

/** 커밋 목록을 기간·규모·월별 활동으로 요약한다. */
export function summarizeContribution(commits: readonly ContributionCommit[]): ContributionSummary {
  const sorted = [...commits].sort((a, b) => Date.parse(a.authoredAt) - Date.parse(b.authoredAt));
  const monthly = new Map<string, number>();
  let additions = 0;
  let deletions = 0;

  for (const commit of sorted) {
    additions += commit.additions;
    deletions += commit.deletions;
    // 서버와 브라우저의 시간대 차이로 결과가 달라지지 않도록 작성자 시각 그대로 자른다.
    const month = commit.authoredAt.slice(0, 7);
    monthly.set(month, (monthly.get(month) ?? 0) + 1);
  }

  return {
    commitCount: sorted.length,
    firstAt: sorted.at(0)?.authoredAt ?? null,
    lastAt: sorted.at(-1)?.authoredAt ?? null,
    additions,
    deletions,
    monthly: [...monthly]
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}
