import '@bestow-ui/react/styles.css';
// 한글 글꼴. 화면에 나온 글자가 든 조각(woff2)만 내려받는다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './globals.css';
import type { Metadata } from 'next';
import { AppProviders } from '@/components/ui/AppProviders';
import { SiteHeader } from '@/features/auth/components/SiteHeader';

export const metadata: Metadata = {
  title: 'shipped',
  description: '커밋 이력을 근거로 경력기술서 초안을 만들어 주는 서비스',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko">
      <body>
        <AppProviders>
          <SiteHeader />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
