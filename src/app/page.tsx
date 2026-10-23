import Link from 'next/link';
import { Suspense } from 'react';
import { getSession } from '@/server/session';

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'GitHub 로그인을 취소했어요.',
  invalid_state: '로그인 요청이 만료됐거나 올바르지 않아요. 다시 시도해 주세요.',
  missing_code: 'GitHub에서 인증 코드를 받지 못했어요. 다시 시도해 주세요.',
  login_failed: '로그인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
  session_expired: '로그인이 만료됐어요. 다시 로그인해 주세요.',
};

const ctaClassName =
  'w-fit rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-85';

export default function Home({ searchParams }: PageProps<'/'>) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-24">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight">shipped</h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          커밋 이력을 근거로 &ldquo;문제 → 해결 → 결과&rdquo; 형식의 경력기술서 초안을 만들어 드려요.
        </p>
      </div>

      {/* 세션과 searchParams는 요청 시점에 읽으므로 정적 셸과 분리해 스트리밍한다. */}
      <Suspense fallback={<div className="h-12 w-44 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />}>
        <AuthAction searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AuthAction({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  const [session, { error }] = await Promise.all([getSession(), searchParams]);
  const errorMessage = typeof error === 'string' ? ERROR_MESSAGES[error] : undefined;

  return (
    <div className="flex flex-col gap-4">
      {errorMessage && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      )}
      {session ? (
        <Link href="/repos" className={ctaClassName}>
          내 레포 보기
        </Link>
      ) : (
        // Route Handler로 이동하므로 Link(프리페치) 대신 a를 쓴다.
        <a href="/api/auth/login" className={ctaClassName}>
          GitHub로 시작하기
        </a>
      )}
    </div>
  );
}
