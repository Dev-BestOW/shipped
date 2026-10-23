import { Link } from '@bestow-ui/react';
import NextLink from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense, type ComponentProps } from 'react';
import { EmptyState, Page, PageHeader } from '@/components/ui/Page';
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
    <Page>
      <PageHeader
        before={
          <Link asChild color="neutral" underline="hover">
            <NextLink href="/repos">← 내 레포</NextLink>
          </Link>
        }
        title={
          <Link href={contribution.url} color="inherit" underline="hover" external>
            {contribution.fullName}
          </Link>
        }
        description={
          contribution.defaultBranch && (
            <>
              기본 브랜치 <code>{contribution.defaultBranch}</code>에서 내가 작성한 커밋만 모았어요. 머지 커밋과
              다른 사람이 작성한 커밋은 빠져요.
            </>
          )
        }
      />

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
        <EmptyState title="아직 커밋이 없는 빈 레포예요." />
      )}
    </Page>
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
