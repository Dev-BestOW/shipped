import 'server-only';
import { z } from 'zod';
import { getEnv } from '../env';

const TOKEN_URL = 'https://github.com/login/oauth/access_token';

export function getCallbackUrl(): string {
  return new URL('/api/auth/callback', getEnv().APP_URL).toString();
}

/**
 * GitHub App은 scope를 받지 않는다. 권한은 앱 설정의 Permissions로 정해진다.
 * selectAccount면 계정 선택 화면을 띄운다. 없으면 GitHub에 로그인된 계정으로 바로 승인돼서,
 * 로그아웃한 뒤에도 같은 계정으로 다시 들어온다.
 */
export function buildAuthorizeUrl(state: string, { selectAccount = false }: { selectAccount?: boolean } = {}): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', getEnv().GITHUB_APP_CLIENT_ID);
  url.searchParams.set('redirect_uri', getCallbackUrl());
  url.searchParams.set('state', state);
  if (selectAccount) url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export function getInstallUrl(): string {
  return `https://github.com/apps/${getEnv().GITHUB_APP_SLUG}/installations/new`;
}

const tokenSuccessSchema = z.object({
  access_token: z.string(),
  /** 초 단위. 앱 설정에서 토큰 만료를 끄면 오지 않는다. */
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
});

/** GitHub는 실패해도 200으로 응답하고 본문에 error를 담는다. */
const tokenErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

export type GitHubTokens = {
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
};

export class GitHubTokenError extends Error {
  constructor(readonly code: string, description?: string) {
    super(description ?? code);
    this.name = 'GitHubTokenError';
  }
}

async function requestToken(params: Record<string, string>): Promise<GitHubTokens> {
  const { GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET } = getEnv();
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: GITHUB_APP_CLIENT_ID,
      client_secret: GITHUB_APP_CLIENT_SECRET,
      ...params,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new GitHubTokenError('http_error', `토큰 요청 실패 (HTTP ${response.status})`);
  }

  const body: unknown = await response.json();
  const failure = tokenErrorSchema.safeParse(body);
  if (failure.success) {
    throw new GitHubTokenError(failure.data.error, failure.data.error_description);
  }

  const tokens = tokenSuccessSchema.parse(body);
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accessTokenExpiresAt:
      tokens.expires_in !== undefined ? Date.now() + tokens.expires_in * 1000 : undefined,
  };
}

export function exchangeCodeForTokens(code: string): Promise<GitHubTokens> {
  return requestToken({ code, redirect_uri: getCallbackUrl() });
}

/** GitHub refresh token은 한 번만 쓸 수 있다. 응답의 새 refresh token을 반드시 저장해야 한다. */
export function refreshTokens(refreshToken: string): Promise<GitHubTokens> {
  return requestToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
}
