import 'server-only';
import { z } from 'zod';

const API_URL = 'https://api.github.com';
const API_VERSION = '2022-11-28';

export class GitHubApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

async function githubGet<T>(token: string, path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': API_VERSION,
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new GitHubApiError(response.status, `GitHub API ${path} 요청 실패 (HTTP ${response.status})`);
  }
  return schema.parse(await response.json());
}

const graphqlErrorsSchema = z.object({
  errors: z.array(z.object({ type: z.string().optional(), message: z.string() })).optional(),
});

/**
 * GitHub GraphQL 요청. GraphQL은 일부가 실패해도 200으로 응답하고 본문에 errors를 담는다.
 * `allowNotFound`면 NOT_FOUND 오류는 무시하고 data(해당 필드는 null)를 그대로 돌려준다.
 */
export async function githubGraphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
  dataSchema: z.ZodType<T>,
  { allowNotFound = false }: { allowNotFound?: boolean } = {},
): Promise<T> {
  const response = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new GitHubApiError(response.status, `GitHub GraphQL 요청 실패 (HTTP ${response.status})`);
  }

  const body: unknown = await response.json();
  const errors = (graphqlErrorsSchema.parse(body).errors ?? []).filter(
    error => !(allowNotFound && error.type === 'NOT_FOUND'),
  );
  if (errors.length > 0) {
    throw new GitHubApiError(200, `GitHub GraphQL 오류: ${errors.map(error => error.message).join(', ')}`);
  }
  return z.object({ data: dataSchema }).parse(body).data;
}

const userSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullable(),
  avatar_url: z.url(),
});

export async function getAuthenticatedUser(token: string) {
  const user = await githubGet(token, '/user', userSchema);
  return { id: user.id, login: user.login, name: user.name, avatarUrl: user.avatar_url };
}

const installationsSchema = z.object({
  installations: z.array(
    z.object({
      id: z.number(),
      account: z.object({ login: z.string() }).nullable(),
    }),
  ),
});

const repositorySchema = z.object({
  id: z.number(),
  full_name: z.string(),
  html_url: z.url(),
  description: z.string().nullable(),
  private: z.boolean(),
  language: z.string().nullable(),
  pushed_at: z.string().nullable(),
});

const installationReposSchema = z.object({
  total_count: z.number(),
  repositories: z.array(repositorySchema),
});

export type Repository = {
  id: number;
  fullName: string;
  url: string;
  description: string | null;
  isPrivate: boolean;
  language: string | null;
  pushedAt: string | null;
};

/** 설치당 가져올 최대 페이지 수. 100개씩이라 설치당 최대 1,000개. */
const MAX_PAGES = 10;

async function listInstallationRepos(token: string, installationId: number) {
  const repos: z.infer<typeof repositorySchema>[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await githubGet(
      token,
      `/user/installations/${installationId}/repositories?per_page=100&page=${page}`,
      installationReposSchema,
    );
    repos.push(...data.repositories);
    if (repos.length >= data.total_count || data.repositories.length === 0) break;
  }
  return repos;
}

/**
 * 사용자가 GitHub App 설치로 접근을 허용한 레포 목록.
 * 사용자 토큰은 "앱이 설치된 레포"와 "사용자가 접근할 수 있는 레포"의 교집합만 볼 수 있다.
 */
export async function listAccessibleRepos(token: string): Promise<Repository[]> {
  const { installations } = await githubGet(token, '/user/installations', installationsSchema);
  const perInstallation = await Promise.all(
    installations.map(installation => listInstallationRepos(token, installation.id)),
  );

  const byId = new Map<number, Repository>();
  for (const repo of perInstallation.flat()) {
    byId.set(repo.id, {
      id: repo.id,
      fullName: repo.full_name,
      url: repo.html_url,
      description: repo.description,
      isPrivate: repo.private,
      language: repo.language,
      pushedAt: repo.pushed_at,
    });
  }

  return [...byId.values()].sort((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''));
}
