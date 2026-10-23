'use client';

import { SkipLink, ThemeProvider } from '@bestow-ui/react';
import type { ReactNode } from 'react';
import styles from './AppProviders.module.css';

/** 앱 전체를 감싸는 Provider. ThemeProvider가 클라이언트 컴포넌트라 레이아웃에서 분리한다. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    // system: OS 설정을 따른다. 서버 렌더링도 CSS 미디어쿼리로 그려 첫 화면이 깜빡이지 않는다.
    <ThemeProvider theme="system" className={styles.root}>
      {/* 첫 Tab에 나타나 머리글을 건너뛰고 본문(#main)으로 간다 */}
      <SkipLink />
      {children}
    </ThemeProvider>
  );
}
