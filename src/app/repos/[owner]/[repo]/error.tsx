'use client';

export default function RepoContributionError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-start gap-4 px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">커밋을 불러오지 못했어요</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        GitHub 응답이 늦거나 일시적인 문제가 있을 수 있어요. 잠시 후 다시 시도해 주세요.
      </p>
      <button
        type="button"
        onClick={retry}
        className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85"
      >
        다시 시도
      </button>
    </main>
  );
}
