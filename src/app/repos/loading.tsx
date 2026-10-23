export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12" aria-busy="true">
      <div className="h-8 w-32 animate-pulse rounded bg-black/10 dark:bg-white/10" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
        ))}
      </div>
      <span className="sr-only">레포 목록을 불러오는 중이에요.</span>
    </main>
  );
}
