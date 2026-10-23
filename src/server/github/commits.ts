import 'server-only';
import { z } from 'zod';
import type { ContributionCommit } from '@/features/repos/lib/contribution';
import { isLockfile } from '@/features/repos/lib/excluded-files';
import { githubGet, githubGraphql } from './api';

/**
 * 100개씩 5페이지, 레포당 최대 500개까지 가져온다.
 * 커밋마다 상세 API를 한 번씩 더 부르므로(사용자 토큰 한도: 시간당 5,000회) 상한을 낮게 둔다.
 */
const PAGE_SIZE = 100;
const MAX_PAGES = 5;
/** 커밋 상세 API를 동시에 부르는 수 */
const DETAIL_CONCURRENCY = 10;
/** 커밋 상세 API의 파일 목록 페이지 크기. GitHub는 커밋당 최대 3,000개 파일까지 준다. */
const FILES_PAGE_SIZE = 100;
const MAX_FILE_PAGES = 30;

const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    viewer {
      id
    }
  }
`;

const viewerSchema = z.object({ viewer: z.object({ id: z.string() }) });

/**
 * `author: {id}`는 커밋 작성자(author) 이메일이 해당 계정에 연결된 커밋만 고른다.
 * committer(리베이스·머지한 사람)나 Co-authored-by는 포함되지 않는다.
 */
const MY_COMMITS_QUERY = /* GraphQL */ `
  query MyCommits($owner: String!, $name: String!, $author: ID!, $pageSize: Int!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      nameWithOwner
      url
      isPrivate
      defaultBranchRef {
        name
        target {
          ... on Commit {
            all: history {
              totalCount
            }
            mine: history(first: $pageSize, after: $cursor, author: { id: $author }) {
              totalCount
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                oid
                messageHeadline
                message
                authoredDate
                url
                parents {
                  totalCount
                }
              }
            }
          }
        }
      }
    }
  }
`;

const commitNodeSchema = z.object({
  oid: z.string(),
  messageHeadline: z.string(),
  message: z.string(),
  authoredDate: z.string(),
  url: z.url(),
  parents: z.object({ totalCount: z.number() }),
});

const myCommitsSchema = z.object({
  repository: z
    .object({
      nameWithOwner: z.string(),
      url: z.url(),
      isPrivate: z.boolean(),
      defaultBranchRef: z
        .object({
          name: z.string(),
          target: z.object({
            all: z.object({ totalCount: z.number() }),
            mine: z.object({
              totalCount: z.number(),
              pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
              nodes: z.array(commitNodeSchema),
            }),
          }),
        })
        .nullable(),
    })
    .nullable(),
});

type MyCommitsData = z.infer<typeof myCommitsSchema>;
type CommitNode = z.infer<typeof commitNodeSchema>;

const commitFilesSchema = z.object({
  files: z
    .array(z.object({ filename: z.string(), additions: z.number(), deletions: z.number() }))
    .optional(),
});

type LineStats = Pick<ContributionCommit, 'additions' | 'deletions' | 'changedFiles'>;

/**
 * 커밋의 변경 줄 수를 lockfile을 빼고 센다.
 * GraphQL은 커밋 단위 합계만 주므로 REST 상세 API의 파일별 값을 쓴다.
 */
async function getLineStats(token: string, repo: string, sha: string): Promise<LineStats> {
  const stats: LineStats = { additions: 0, deletions: 0, changedFiles: 0 };
  for (let page = 1; page <= MAX_FILE_PAGES; page++) {
    const { files = [] } = await githubGet(
      token,
      `/repos/${repo}/commits/${sha}?per_page=${FILES_PAGE_SIZE}&page=${page}`,
      commitFilesSchema,
    );
    for (const file of files) {
      if (isLockfile(file.filename)) continue;
      stats.additions += file.additions;
      stats.deletions += file.deletions;
      stats.changedFiles++;
    }
    if (files.length < FILES_PAGE_SIZE) break;
  }
  return stats;
}

/** 순서를 유지하면서 동시에 최대 limit개씩 실행한다. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export type RepoContribution = {
  fullName: string;
  url: string;
  isPrivate: boolean;
  /** 커밋이 하나도 없는 빈 레포면 null */
  defaultBranch: string | null;
  /** 기본 브랜치 전체 커밋 수 (머지 커밋 포함) */
  totalCommits: number;
  /** 기본 브랜치에서 내가 작성한 커밋 수 (머지 커밋 포함) */
  myTotalCommits: number;
  /** 머지 커밋을 뺀 내 커밋. 최신순, 최대 PAGE_SIZE × MAX_PAGES개. 변경 줄 수에서 lockfile은 뺀다. */
  commits: ContributionCommit[];
  /** 내 커밋이 많아 일부만 가져왔으면 true */
  truncated: boolean;
};

/** 레포에 접근할 수 없으면 null. */
export async function getMyRepoContribution(
  token: string,
  owner: string,
  name: string,
): Promise<RepoContribution | null> {
  const { viewer } = await githubGraphql(token, VIEWER_QUERY, {}, viewerSchema);

  const nodes: CommitNode[] = [];
  let cursor: string | null = null;
  let truncated = false;
  let first: MyCommitsData['repository'] | undefined;

  for (let page = 1; page <= MAX_PAGES; page++) {
    // cursor가 이전 응답에서 오므로 타입을 직접 적어 순환 추론을 끊는다.
    const data: MyCommitsData = await githubGraphql(
      token,
      MY_COMMITS_QUERY,
      { owner, name, author: viewer.id, pageSize: PAGE_SIZE, cursor },
      myCommitsSchema,
      { allowNotFound: true },
    );
    const { repository } = data;
    if (!repository) return null;
    first ??= repository;

    const history = repository.defaultBranchRef?.target.mine;
    if (!history) break;

    // 머지 커밋은 다른 브랜치의 변경을 합친 것이라 본인 작업 근거에서 뺀다.
    nodes.push(...history.nodes.filter(node => node.parents.totalCount === 1));

    if (!history.pageInfo.hasNextPage) break;
    if (page === MAX_PAGES) {
      truncated = true;
      break;
    }
    cursor = history.pageInfo.endCursor;
  }

  if (!first) return null;
  const repo = first.nameWithOwner;
  const commits = await mapWithConcurrency(nodes, DETAIL_CONCURRENCY, async node => ({
    sha: node.oid,
    headline: node.messageHeadline,
    message: node.message,
    authoredAt: node.authoredDate,
    url: node.url,
    ...(await getLineStats(token, repo, node.oid)),
  }));

  const branch = first.defaultBranchRef;
  return {
    fullName: first.nameWithOwner,
    url: first.url,
    isPrivate: first.isPrivate,
    defaultBranch: branch?.name ?? null,
    totalCommits: branch?.target.all.totalCount ?? 0,
    myTotalCommits: branch?.target.mine.totalCount ?? 0,
    commits,
    truncated,
  };
}
