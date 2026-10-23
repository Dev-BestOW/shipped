import 'server-only';
import { z } from 'zod';

const envSchema = z.object({
  APP_URL: z.url(),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1),
  GITHUB_APP_SLUG: z.string().min(1),
  SESSION_SECRET: z
    .string()
    .refine(
      value => Buffer.from(value, 'base64url').length === 32,
      'SESSION_SECRET은 32바이트 base64url 문자열이어야 해요.',
    ),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** 환경 변수를 검증해서 반환한다. 빌드 시점이 아니라 처음 사용할 때 검사한다. */
export function getEnv(): Env {
  if (!cached) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const fields = result.error.issues.map(issue => issue.path.join('.'));
      throw new Error(
        `환경 변수가 올바르지 않아요: ${fields.join(', ')}. .env.example을 참고해 .env.local을 채워 주세요.`,
      );
    }
    cached = result.data;
  }
  return cached;
}
