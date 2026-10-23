import { describe, expect, it } from 'vitest';
import type { ResumeRequest } from '@/features/resume/lib/schema';
import { findCommits, summarizeWorkAreas } from './analysis';
import { buildResumeUserContent } from './prompt';

type Commit = ResumeRequest['commits'][number];

function commit(sha: string, message: string, authoredAt: string, files: [string, number, number][]): Commit {
  return {
    sha,
    message,
    authoredAt,
    lineStats: {
      additions: files.reduce((sum, [, a]) => sum + a, 0),
      deletions: files.reduce((sum, [, , d]) => sum + d, 0),
      changedFiles: files.length,
      files: files.map(([path, additions, deletions]) => ({ path, additions, deletions })),
    },
  };
}

const commits = [
  commit('aaaaaaa1', 'feat: 로그인', '2026-01-02T10:00:00+09:00', [
    ['src/server/session.ts', 100, 0],
    ['src/server/github/oauth.ts', 50, 0],
  ]),
  commit('bbbbbbb2', 'feat: 레포 목록\n\n- 페이지 추가', '2026-01-05T10:00:00+09:00', [
    ['src/app/repos/page.tsx', 30, 5],
    ['src/server/github/api.ts', 20, 0],
    ['README.md', 3, 1],
  ]),
];

describe('summarizeWorkAreas', () => {
  it('폴더별 커밋 수와 줄 수를 모으고, 줄이 많은 순으로 정렬한다', () => {
    expect(summarizeWorkAreas(commits, 2, 10)).toEqual([
      // 같은 커밋이 한 폴더의 파일을 여러 개 바꿔도 커밋은 한 번만 센다
      { area: 'src/server', commits: 2, additions: 170, deletions: 0 },
      { area: 'src/app', commits: 1, additions: 30, deletions: 5 },
      { area: '(루트)', commits: 1, additions: 3, deletions: 1 },
    ]);
  });

  it('limit만큼만 돌려준다', () => {
    expect(summarizeWorkAreas(commits, 3, 1)).toHaveLength(1);
  });
});

describe('findCommits', () => {
  it('짧은 해시(대소문자 무관)로 찾고 못 찾은 해시는 따로 돌려준다', () => {
    const { found, notFound } = findCommits(commits, ['AAAAAAA', 'ccccccc']);
    expect(found.map(c => c.sha)).toEqual(['aaaaaaa1']);
    expect(notFound).toEqual(['ccccccc']);
  });
});

describe('buildResumeUserContent', () => {
  it('통계와 커밋을 시간순으로 쓰고, 커밋 본문은 들여쓴다', () => {
    const content = buildResumeUserContent({
      projectName: 'shipped',
      commits: [...commits].reverse(),
      share: { mine: 2, total: 4 },
    });

    expect(content).toContain('내 커밋: 2개');
    expect(content).toContain('기간: 2026-01-02 ~ 2026-01-05');
    expect(content).toContain('변경 줄 수: +203 −6 (lockfile 제외)');
    expect(content).toContain('레포 전체 커밋 중 내 커밋: 2 / 4');
    expect(content.indexOf('aaaaaaa')).toBeLessThan(content.indexOf('bbbbbbb'));
    expect(content).toContain('bbbbbbb | 2026-01-05 | +53 −6, 파일 3개 | feat: 레포 목록\n    - 페이지 추가');
  });
});
