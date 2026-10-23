import 'server-only';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getEnv } from './env';

const SESSION_COOKIE = 'shipped_session';
/** 세션 쿠키 수명. GitHub refresh token 수명(약 6개월)보다 짧게 둔다. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
/** 만료 직전 토큰으로 요청하다 실패하지 않도록 여유를 둔다. */
const EXPIRY_SKEW_MS = 60 * 1000;

const sessionSchema = z.object({
  accessToken: z.string(),
  /** GitHub App에서 토큰 만료를 끈 경우 refresh token이 없다. */
  refreshToken: z.string().optional(),
  /** access token 만료 시각(ms). 만료가 없으면 생략한다. */
  accessTokenExpiresAt: z.number().optional(),
  user: z.object({
    id: z.number(),
    login: z.string(),
    name: z.string().nullable(),
    avatarUrl: z.url(),
  }),
});

export type Session = z.infer<typeof sessionSchema>;

function getKey() {
  return new Uint8Array(Buffer.from(getEnv().SESSION_SECRET, 'base64url'));
}

/**
 * 세션에 GitHub 토큰이 들어 있으므로 서명만 하는 JWT가 아니라 암호화(JWE)한다.
 * 서명만 한 JWT는 누구나 base64로 내용을 읽을 수 있다.
 */
async function encrypt(session: Session): Promise<string> {
  return new EncryptJWT({ session })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .encrypt(getKey());
}

async function decrypt(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtDecrypt(token, getKey());
    const result = sessionSchema.safeParse(payload.session);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** 쿠키에서 세션을 읽는다. 없거나 손상됐으면 null. */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? decrypt(token) : null;
}

/** Route Handler나 Server Action에서만 호출할 수 있다. */
export async function saveSession(session: Session): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await encrypt(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Route Handler나 Server Action에서만 호출할 수 있다. */
export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export function isAccessTokenExpired(session: Session): boolean {
  return (
    session.accessTokenExpiresAt !== undefined &&
    session.accessTokenExpiresAt - EXPIRY_SKEW_MS <= Date.now()
  );
}

/**
 * 페이지(Server Component)에서 로그인한 세션을 요구한다.
 * Server Component는 쿠키를 쓸 수 없어서, 토큰이 만료됐으면 갱신용 Route Handler로 보냈다가 돌아온다.
 */
export async function requireSession(returnTo: string): Promise<Session> {
  const session = await getSession();
  if (!session) {
    redirect('/');
  }
  if (isAccessTokenExpired(session)) {
    redirect(`/api/auth/refresh?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return session;
}
