import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${path('./src')}/` },
      // 테스트에서는 서버 전용 모듈도 불러올 수 있도록 빈 모듈로 바꾼다.
      { find: /^server-only$/, replacement: path('./test/stubs/server-only.ts') },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
