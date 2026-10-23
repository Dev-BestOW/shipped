import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { getSession } from '@/server/session';

export function SiteHeader() {
  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-6">
        <Link href="/" className="font-bold tracking-tight">
          shipped
        </Link>
        {/* 세션은 요청 시점에 읽으므로 정적 셸과 분리해 스트리밍한다. */}
        <Suspense fallback={null}>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}

async function UserMenu() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div className="flex items-center gap-3 text-sm">
      <Image src={session.user.avatarUrl} alt="" width={28} height={28} className="rounded-full" />
      <span className="font-medium">{session.user.name ?? session.user.login}</span>
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className="rounded-full border border-black/10 px-3 py-1 text-zinc-600 transition-colors hover:bg-black/5 dark:border-white/15 dark:text-zinc-400 dark:hover:bg-white/10"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
