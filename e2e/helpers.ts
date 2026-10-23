import { loadEnvConfig } from '@next/env';
import type { BrowserContext } from '@playwright/test';
import { EncryptJWT } from 'jose';

/**
 * 로그인한 상태를 흉내 내는 세션 쿠키를 넣는다. src/server/session.ts와 같은 방식으로 암호화한다.
 * 토큰은 가짜라 GitHub API를 부르는 화면(/repos)에서는 쓸 수 없고, 세션만 확인하는 화면에서 쓴다.
 */
export async function signIn(context: BrowserContext, baseURL: string) {
  loadEnvConfig(process.cwd());
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET이 없어요. .env.local을 확인해 주세요.');

  const session = {
    accessToken: 'e2e-fake-token',
    user: { id: 1, login: 'e2e-user', name: 'E2E 사용자', avatarUrl: 'https://avatars.githubusercontent.com/u/1' },
  };
  const token = await new EncryptJWT({ session })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .encrypt(new Uint8Array(Buffer.from(secret, 'base64url')));

  await context.addCookies([{ name: 'shipped_session', value: token, url: baseURL }]);
}

/** GIT_LOG_COMMAND가 만드는 형식의 git log 파일 내용 */
export function sampleGitLog(): string {
  const record = (sha: string, name: string, email: string, date: string, message: string, numstat: string[]) =>
    `\x1e${sha}\x1f${name}\x1f${email}\x1f${date}\x1f${message}\x1d\n\n${numstat.join('\n')}\n`;

  return [
    record('a'.repeat(40), '나', 'me@example.com', '2026-01-05T10:00:00+09:00', 'feat: 로그인 구현', [
      '120\t4\tsrc/auth/login.ts',
      '5000\t0\tpackage-lock.json',
    ]),
    record('b'.repeat(40), '나', 'me@example.com', '2026-02-10T10:00:00+09:00', 'feat: 레포 목록', [
      '80\t10\tsrc/repos/list.ts',
    ]),
    record('c'.repeat(40), '동료', 'teammate@example.com', '2026-02-11T10:00:00+09:00', 'fix: 오타', [
      '1\t1\tREADME.md',
    ]),
  ].join('');
}
