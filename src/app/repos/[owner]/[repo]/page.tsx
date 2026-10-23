import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense, type ComponentProps } from 'react';
import { ContributionReport } from '@/features/repos/components/ContributionReport';
import { summarizeContribution, type ContributionCommit } from '@/features/repos/lib/contribution';
import { addLineStats, getMyRepoContribution } from '@/server/github/commits';
import { requireSession, withTokenRefresh } from '@/server/session';

/** GitHub 계정·레포 이름에 쓸 수 있는 문자 */
const NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

export async function generateMetadata({ params }: PageProps<'/repos/[owner]/[repo]'>) {
  const { owner, repo } = await params;
  return { title: `${owner}/${repo} 기여 분석 · shipped` };
}

export default async function RepoContributionPage({ params }: PageProps<'/repos/[owner]/[repo]'>) {
  const { owner, repo } = await params;
  if (!NAME_PATTERN.test(owner) || !NAME_PATTERN.test(repo)) notFound();

  const returnTo = `/repos/${owner}/${repo}`;
  const session = await requireSession(returnTo);
  const contribution = await withTokenRefresh(returnTo, () =>
    getMyRepoContribution(session.accessToken, owner, repo),
  );
  if (!contribution) notFound();

  const reportProps = {
    share: { mine: contribution.myTotalCommits, total: contribution.totalCommits },
    truncatedNote: contribution.truncated
      ? `내 커밋이 많아 최근 ${contribution.commits.length.toLocaleString('ko-KR')}개만 분석했어요.`
      : undefined,
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <Link href="/repos" className="text-sm text-zinc-500 hover:underline">
          ← 내 레포
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          <a href={contribution.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {contribution.fullName}
          </a>
        </h1>
        {contribution.defaultBranch && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            기본 브랜치 <code className="font-mono">{contribution.defaultBranch}</code>에서 내가 작성한 커밋만
            모았어요. 머지 커밋과 다른 사람이 작성한 커밋은 빠져요.
          </p>
        )}
      </div>

      {contribution.defaultBranch ? (
        // 커밋 목록은 바로 보여 주고, 커밋마다 상세 API가 필요한 변경 줄 수는 다 세면 채워 넣는다.
        <Suspense
          fallback={
            <ContributionReport
              summary={summarizeContribution(contribution.commits)}
              commits={contribution.commits}
              {...reportProps}
            />
          }
        >
          <ReportWithLineStats
            token={session.accessToken}
            repo={contribution.fullName}
            commits={contribution.commits}
            returnTo={returnTo}
            reportProps={reportProps}
          />
        </Suspense>
      ) : (
        <div className="rounded-xl border border-dashed border-black/15 px-6 py-10 dark:border-white/20">
          <p className="font-medium">아직 커밋이 없는 빈 레포예요.</p>
        </div>
      )}
    </main>
  );
}

async function ReportWithLineStats({
  token,
  repo,
  commits,
  returnTo,
  reportProps,
}: {
  token: string;
  repo: string;
  commits: ContributionCommit[];
  returnTo: string;
  reportProps: Pick<ComponentProps<typeof ContributionReport>, 'share' | 'truncatedNote'>;
}) {
  const withStats = await withTokenRefresh(returnTo, () => addLineStats(token, repo, commits));
  return <ContributionReport summary={summarizeContribution(withStats)} commits={withStats} {...reportProps} />;
}
