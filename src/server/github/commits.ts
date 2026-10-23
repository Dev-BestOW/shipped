import 'server-only';
import { z } from 'zod';
import type { ContributionCommit } from '@/features/repos/lib/contribution';
import { githubGraphql } from './api';

/** 100개씩 10페이지, 레포당 최대 1,000개까지 가져온다. */
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

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
                additions
                deletions
                changedFilesIfAvailable
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
  additions: z.number(),
  deletions: z.number(),
  changedFilesIfAvailable: z.number().nullable(),
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
  /** 머지 커밋을 뺀 내 커밋. 최신순, 최대 PAGE_SIZE × MAX_PAGES개 */
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

  const commits: ContributionCommit[] = [];
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

    for (const node of history.nodes) {
      // 머지 커밋은 다른 브랜치의 변경을 합친 것이라 본인 작업 근거에서 뺀다.
      if (node.parents.totalCount > 1) continue;
      commits.push({
        sha: node.oid,
        headline: node.messageHeadline,
        message: node.message,
        authoredAt: node.authoredDate,
        additions: node.additions,
        deletions: node.deletions,
        changedFiles: node.changedFilesIfAvailable,
        url: node.url,
      });
    }

    if (!history.pageInfo.hasNextPage) break;
    if (page === MAX_PAGES) {
      truncated = true;
      break;
    }
    cursor = history.pageInfo.endCursor;
  }

  if (!first) return null;
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
