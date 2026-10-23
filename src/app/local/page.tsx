import { LocalLogUpload } from '@/features/repos/components/LocalLogUpload';

export const metadata = { title: 'git log로 분석 · shipped' };

export default function LocalLogPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">git log로 분석하기</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          회사 GitLab처럼 GitHub에 연결할 수 없는 레포도 커밋 기록 파일만 있으면 분석할 수 있어요.
        </p>
      </div>
      <LocalLogUpload />
    </main>
  );
}
