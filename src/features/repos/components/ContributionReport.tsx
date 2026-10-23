import type { ReactNode } from 'react';
import type { ContributionCommit, ContributionSummary } from '../lib/contribution';

/** 처음에 펼쳐 보여 줄 커밋 수. 나머지는 접어 둔다. */
const VISIBLE_COMMITS = 30;

// 서버와 브라우저에서 같은 결과가 나오도록 시간대를 고정한다.
const dateFormatter = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' });
const numberFormatter = new Intl.NumberFormat('ko-KR');
const percentFormatter = new Intl.NumberFormat('ko-KR', { style: 'percent', maximumFractionDigits: 1 });

type Props = {
  summary: ContributionSummary;
  commits: readonly ContributionCommit[];
  /** 레포 전체 커밋 중 내 커밋 비중. 전체 커밋 수를 알 수 없으면 생략한다. */
  share?: { mine: number; total: number };
  /** 커밋이 많아 일부만 분석했으면 안내 문구를 보여 준다. */
  truncatedNote?: string;
  /** 내 커밋이 없을 때 보여 줄 도움말 */
  emptyHint?: string;
};

export function ContributionReport({
  summary,
  commits,
  share,
  truncatedNote,
  emptyHint = '커밋 작성자 이메일이 GitHub 계정에 등록돼 있는지 확인해 주세요. 머지 커밋은 분석에서 빠져요.',
}: Props) {
  if (summary.commitCount === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-black/15 px-6 py-10 dark:border-white/20">
        <p className="font-medium">내가 작성한 커밋을 찾지 못했어요.</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{emptyHint}</p>
      </div>
    );
  }

  const newestFirst = [...commits].sort((a, b) => Date.parse(b.authoredAt) - Date.parse(a.authoredAt));
  const visible = newestFirst.slice(0, VISIBLE_COMMITS);
  const hidden = newestFirst.slice(VISIBLE_COMMITS);

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="내 커밋">{numberFormatter.format(summary.commitCount)}개</Stat>
        <Stat label="활동 기간">
          {summary.firstAt && summary.lastAt && (
            <span className="text-base">
              {dateFormatter.format(new Date(summary.firstAt))}
              <br />~ {dateFormatter.format(new Date(summary.lastAt))}
            </span>
          )}
        </Stat>
        <Stat label="활동한 달">{numberFormatter.format(summary.monthly.length)}개월</Stat>
        <Stat label="변경한 줄">
          <span className="text-base">
            <span className="text-green-700 dark:text-green-400">+{numberFormatter.format(summary.additions)}</span>{' '}
            <span className="text-red-700 dark:text-red-400">−{numberFormatter.format(summary.deletions)}</span>
          </span>
        </Stat>
        {share && share.total > 0 && (
          <Stat label="전체 커밋 중 비중">
            {percentFormatter.format(share.mine / share.total)}
            <span className="block text-xs font-normal text-zinc-500">
              {numberFormatter.format(share.mine)} / {numberFormatter.format(share.total)}
            </span>
          </Stat>
        )}
      </dl>

      {truncatedNote && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {truncatedNote}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">내 커밋</h2>
        <CommitList commits={visible} />
        {hidden.length > 0 && (
          <details className="group flex flex-col gap-3">
            <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-400">
              이전 커밋 {numberFormatter.format(hidden.length)}개 더 보기
            </summary>
            <div className="mt-3">
              <CommitList commits={hidden} />
            </div>
          </details>
        )}
      </section>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-black/10 px-4 py-3 dark:border-white/15">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-xl font-semibold">{children}</dd>
    </div>
  );
}

function CommitList({ commits }: { commits: readonly ContributionCommit[] }) {
  return (
    <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/15 dark:border-white/15">
      {commits.map(commit => (
        <li key={commit.sha} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-baseline sm:gap-4">
          <span className="min-w-0 flex-1 truncate text-sm" title={commit.headline}>
            {commit.headline}
          </span>
          <span className="flex shrink-0 items-baseline gap-3 text-xs text-zinc-500">
            <span>
              <span className="text-green-700 dark:text-green-400">+{numberFormatter.format(commit.additions)}</span>{' '}
              <span className="text-red-700 dark:text-red-400">−{numberFormatter.format(commit.deletions)}</span>
            </span>
            <time dateTime={commit.authoredAt}>{dateFormatter.format(new Date(commit.authoredAt))}</time>
            {commit.url ? (
              <a href={commit.url} target="_blank" rel="noopener noreferrer" className="font-mono hover:underline">
                {commit.sha.slice(0, 7)}
              </a>
            ) : (
              <span className="font-mono">{commit.sha.slice(0, 7)}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
