import { expect, test, type Page } from '@playwright/test';
import { sampleGitLog, signIn } from './helpers';

test('홈에서 GitHub 로그인을 시작할 수 있다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'shipped' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'GitHub로 시작하기' })).toHaveAttribute('href', '/api/auth/login');
});

/** /local에 git log를 올리고 내 이메일을 고른다. */
async function uploadAndPickMe(page: Page) {
  await page.goto('/local');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'shipped-log.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(sampleGitLog()),
  });
  await expect(page.getByText('shipped-log.txt에서 커밋 3개를 읽었어요.')).toBeVisible();
  await page.getByRole('checkbox', { name: /me@example\.com/ }).check();
}

test('git log를 올리고 내 이메일을 고르면 내 커밋만 분석한다', async ({ page }) => {
  await uploadAndPickMe(page);

  const stats = page.locator('dl').first();
  await expect(stats.getByText('2개', { exact: true })).toBeVisible(); // 내 커밋 (동료 커밋 제외)
  await expect(stats.getByText('+200')).toBeVisible(); // lockfile 5000줄은 빠진다
  await expect(stats.getByText('2 / 3')).toBeVisible(); // 전체 커밋 중 비중
  await expect(page.getByText('feat: 레포 목록')).toBeVisible();
  await expect(page.getByText('fix: 오타')).toHaveCount(0);
});

test('로그인하지 않으면 초안 생성 대신 로그인을 안내한다', async ({ page }) => {
  await uploadAndPickMe(page);
  await page.getByRole('button', { name: '초안 만들기' }).click();

  // Next의 페이지 이동 안내(__next-route-announcer__)도 role="alert"라서 문구로 찾는다.
  await expect(page.getByRole('alert').filter({ hasText: 'GitHub로 로그인한 뒤 쓸 수 있어요' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'GitHub로 로그인' })).toBeVisible();
});

test('로그인하면 분석 단계를 거쳐 초안을 만들고 문장을 검토할 수 있다', async ({ page, context, baseURL }) => {
  await signIn(context, baseURL!);
  await uploadAndPickMe(page);
  await page.getByLabel('프로젝트 이름').fill('E2E 프로젝트');
  await page.getByRole('button', { name: '초안 만들기' }).click();

  await expect(page.getByRole('list', { name: '분석 단계' })).toContainText('작업 영역 살펴보기');
  await expect(page.getByText('개발용 가짜 응답', { exact: true })).toBeVisible();

  // 완성되면 검토 도구가 나온다. 가짜 초안은 성과 2개 × 문장 3개다 (커밋 2개라 묶음 2개).
  const counts = page.getByText(/^수락 \d+ · 수정 \d+ · 거절 \d+ · 남음 \d+$/);
  await expect(counts).toHaveText('수락 0 · 수정 0 · 거절 0 · 남음 6', { timeout: 30_000 });

  await page.getByRole('button', { name: '수락', exact: true }).first().click();
  await page.getByRole('button', { name: '거절', exact: true }).first().click();
  await expect(counts).toHaveText('수락 1 · 수정 0 · 거절 1 · 남음 4');

  await page.getByRole('button', { name: '남은 문장 모두 수락' }).click();
  await expect(counts).toHaveText('수락 5 · 수정 0 · 거절 1 · 남음 0');
  await expect(page.getByRole('button', { name: '수락한 문장 5개 복사' })).toBeEnabled();

  // PDF로 저장(인쇄)할 때는 수락한 문장만 담은 경력기술서만 보이고, 화면의 검토 카드는 숨는다.
  await page.emulateMedia({ media: 'print' });
  const printable = page.locator('[data-print-root]');
  await expect(printable).toBeVisible();
  await expect(printable.getByRole('heading', { level: 1 })).toHaveText('E2E 프로젝트');
  await expect(printable.locator('li')).toHaveCount(5); // 거절한 1문장은 빠진다
  await expect(page.getByRole('button', { name: 'PDF로 저장' })).toBeHidden();
});
