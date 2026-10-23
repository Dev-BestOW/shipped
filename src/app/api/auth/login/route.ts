import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildAuthorizeUrl } from '@/server/github/oauth';
import { OAUTH_STATE_COOKIE } from '@/server/github/state';

export async function GET() {
  // CSRF 방지: 콜백에서 같은 값이 돌아오는지 확인한다.
  const state = randomBytes(16).toString('base64url');

  (await cookies()).set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(buildAuthorizeUrl(state));
}
