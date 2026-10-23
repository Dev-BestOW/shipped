import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/server/github/api';
import { exchangeCodeForTokens } from '@/server/github/oauth';
import { OAUTH_STATE_COOKIE } from '@/server/github/state';
import { saveSession } from '@/server/session';

function isSameState(expected: string | undefined, actual: string | null): boolean {
  if (!expected || !actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

function redirectWithError(request: NextRequest, reason: string) {
  return NextResponse.redirect(new URL(`/?error=${reason}`, request.url));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete({ name: OAUTH_STATE_COOKIE, path: '/api/auth' });

  // 사용자가 GitHub 화면에서 승인을 취소한 경우
  if (searchParams.get('error')) {
    return redirectWithError(request, 'access_denied');
  }

  if (!isSameState(expectedState, searchParams.get('state'))) {
    return redirectWithError(request, 'invalid_state');
  }

  const code = searchParams.get('code');
  if (!code) {
    return redirectWithError(request, 'missing_code');
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const user = await getAuthenticatedUser(tokens.accessToken);
    await saveSession({ ...tokens, user });
  } catch (error) {
    console.error('[auth/callback]', error);
    return redirectWithError(request, 'login_failed');
  }

  return NextResponse.redirect(new URL('/repos', request.url));
}
