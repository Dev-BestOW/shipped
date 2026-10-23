import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { buildAuthorizeUrl } from '@/server/github/oauth';
import { OAUTH_STATE_COOKIE } from '@/server/github/state';

/** `?select_account=1`이면 GitHub 계정 선택 화면을 띄운다 (다른 계정으로 로그인). */
export async function GET(request: NextRequest) {
  // CSRF 방지: 콜백에서 같은 값이 돌아오는지 확인한다.
  const state = randomBytes(16).toString('base64url');

  (await cookies()).set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 60 * 10,
  });

  const selectAccount = request.nextUrl.searchParams.get('select_account') === '1';
  return NextResponse.redirect(buildAuthorizeUrl(state, { selectAccount }));
}
