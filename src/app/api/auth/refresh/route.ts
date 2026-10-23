import { NextResponse, type NextRequest } from 'next/server';
import { refreshTokens } from '@/server/github/oauth';
import { clearSession, getSession, saveSession } from '@/server/session';

/** 외부 주소로 보내는 오픈 리다이렉트를 막기 위해 같은 사이트 경로만 허용한다. */
function safeReturnTo(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/repos';
}

export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get('returnTo'));
  const session = await getSession();

  if (!session?.refreshToken) {
    await clearSession();
    return NextResponse.redirect(new URL('/?error=session_expired', request.url));
  }

  try {
    const tokens = await refreshTokens(session.refreshToken);
    await saveSession({ ...tokens, user: session.user });
  } catch (error) {
    console.error('[auth/refresh]', error);
    await clearSession();
    return NextResponse.redirect(new URL('/?error=session_expired', request.url));
  }

  return NextResponse.redirect(new URL(returnTo, request.url));
}
