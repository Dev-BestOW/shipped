import { defineConfig, devices } from '@playwright/test';

/** 로컬에서 dev 서버와 겹치지 않게 E2E_PORT로 바꿀 수 있다. */
const PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    // 로컬에서는 설치된 Chrome을 쓴다. CI에서는 `npx playwright install chromium` 후 기본 Chromium을 쓴다.
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome' } },
  ],
  webServer: {
    // CI에서는 미리 빌드한 프로덕션 서버로, 로컬에서는 dev 서버로 띄운다.
    command: process.env.CI ? `npm run start -- --port ${PORT}` : `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // 로컬에서 이미 띄운 dev 서버가 있으면 그대로 쓴다 (같은 폴더에서 next dev를 두 번 띄울 수 없다).
    reuseExistingServer: !process.env.CI,
    // Claude를 부르지 않도록 가짜 응답 모드로 띄운다.
    env: { RESUME_MOCK: '1' },
  },
});
