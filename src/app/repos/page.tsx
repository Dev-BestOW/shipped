import { Link, Typography } from '@bestow-ui/react';
import NextLink from 'next/link';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { EmptyState, Page, PageHeader } from '@/components/ui/Page';
import { RepoList } from '@/features/repos/components/RepoList';
import { listAccessibleRepos } from '@/server/github/api';
import { getInstallUrl } from '@/server/github/oauth';
import { requireSession, withTokenRefresh } from '@/server/session';

export const metadata = { title: '내 레포 · shipped' };

export default async function ReposPage() {
  const session = await requireSession('/repos');
  const repos = await withTokenRefresh('/repos', () => listAccessibleRepos(session.accessToken));
  const installUrl = getInstallUrl();

  return (
    <Page>
      <PageHeader
        title="내 레포"
        description="shipped 앱에 접근을 허용한 레포만 보여요. 권한은 읽기 전용이에요."
        action={
          <ButtonLink href={installUrl} variant="outline" color="neutral" size="sm" native>
            레포 추가·변경
          </ButtonLink>
        }
      />

      {repos.length > 0 ? (
        <RepoList repos={repos} />
      ) : (
        <EmptyState title="아직 접근을 허용한 레포가 없어요.">
          <Typography variant="body-sm" color="muted">
            GitHub에서 shipped 앱을 설치하고, 분석할 레포를 골라 주세요.
          </Typography>
          <ButtonLink href={installUrl} native>
            GitHub에서 레포 선택하기
          </ButtonLink>
        </EmptyState>
      )}

      <Typography variant="body-sm" color="muted">
        회사 GitLab처럼 GitHub에 없는 레포는{' '}
        <Link asChild>
          <NextLink href="/local">git log 파일로 분석</NextLink>
        </Link>
        할 수 있어요.
      </Typography>
    </Page>
  );
}
