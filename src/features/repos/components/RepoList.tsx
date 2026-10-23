import type { Repository } from '@/server/github/api';

const dateFormatter = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' });

export function RepoList({ repos }: { repos: Repository[] }) {
  return (
    <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/15 dark:border-white/15">
      {repos.map(repo => (
        <li key={repo.id} className="flex flex-col gap-1 px-5 py-4">
          <div className="flex items-center gap-2">
            <a
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline"
            >
              {repo.fullName}
            </a>
            {repo.isPrivate && (
              <span className="rounded-full border border-black/15 px-2 text-xs text-zinc-500 dark:border-white/20">
                비공개
              </span>
            )}
          </div>
          {repo.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{repo.description}</p>
          )}
          <p className="text-xs text-zinc-500">
            {[repo.language, repo.pushedAt && `최근 푸시 ${dateFormatter.format(new Date(repo.pushedAt))}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </li>
      ))}
    </ul>
  );
}
