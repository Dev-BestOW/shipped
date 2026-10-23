import 'server-only';
import type { ResumeRequest } from '@/features/resume/lib/schema';

type Commit = ResumeRequest['commits'][number];

export type WorkArea = {
  /** 폴더 경로 (예: src/features/repos). 루트 파일은 '(루트)' */
  area: string;
  commits: number;
  additions: number;
  deletions: number;
};

/** 경로의 앞 depth개 폴더를 작업 영역으로 본다. */
function areaOf(path: string, depth: number): string {
  const dirs = path.split('/').slice(0, -1);
  return dirs.length === 0 ? '(루트)' : dirs.slice(0, depth).join('/');
}

/** 폴더별로 내 커밋 수와 변경 줄 수를 모은다. 변경 줄이 많은 순. */
export function summarizeWorkAreas(commits: readonly Commit[], depth: number, limit: number): WorkArea[] {
  const byArea = new Map<string, WorkArea>();
  for (const commit of commits) {
    const touched = new Set<string>();
    for (const file of commit.lineStats?.files ?? []) {
      const area = areaOf(file.path, depth);
      const entry = byArea.get(area) ?? { area, commits: 0, additions: 0, deletions: 0 };
      entry.additions += file.additions;
      entry.deletions += file.deletions;
      if (!touched.has(area)) {
        entry.commits++;
        touched.add(area);
      }
      byArea.set(area, entry);
    }
  }
  return [...byArea.values()]
    .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))
    .slice(0, limit);
}

/** 짧은 해시(앞부분)로 커밋을 찾는다. 못 찾은 해시는 notFound에 담는다. */
export function findCommits(commits: readonly Commit[], shas: readonly string[]) {
  const found: Commit[] = [];
  const notFound: string[] = [];
  for (const sha of shas) {
    const commit = commits.find(c => c.sha.startsWith(sha.toLowerCase()));
    if (commit) {
      found.push(commit);
    } else {
      notFound.push(sha);
    }
  }
  return { found, notFound };
}
