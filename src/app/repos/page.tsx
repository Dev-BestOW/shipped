import { RepoList } from '@/features/repos/components/RepoList';
import { GitHubApiError, listAccessibleRepos } from '@/server/github/api';
import { getInstallUrl } from '@/server/github/oauth';
import { requireSession } from '@/server/session';
import { redirect } from 'next/navigation';

export const metadata = { title: '내 레포 · shipped' };

async function loadRepos(accessToken: string) {
  try {
    return await listAccessibleRepos(accessToken);
  } catch (error) {
    // 토큰이 만료 시각 전에 무효화된 경우(앱 권한 회수 등)에는 갱신을 시도한다.
    if (error instanceof GitHubApiError && error.status === 401) {
      redirect('/api/auth/refresh?returnTo=/repos');
    }
    throw error;
  }
}

export default async function ReposPage() {
  const session = await requireSession('/repos');
  const repos = await loadRepos(session.accessToken);
  const installUrl = getInstallUrl();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">내 레포</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            shipped 앱에 접근을 허용한 레포만 보여요. 권한은 읽기 전용이에요.
          </p>
        </div>
        <a
          href={installUrl}
          className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          레포 추가·변경
        </a>
      </div>

      {repos.length > 0 ? (
        <RepoList repos={repos} />
      ) : (
        <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-black/15 px-6 py-10 dark:border-white/20">
          <p className="font-medium">아직 접근을 허용한 레포가 없어요.</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            GitHub에서 shipped 앱을 설치하고, 분석할 레포를 골라 주세요.
          </p>
          <a
            href={installUrl}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85"
          >
            GitHub에서 레포 선택하기
          </a>
        </div>
      )}
    </main>
  );
}
