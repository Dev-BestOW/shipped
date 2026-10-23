import NextLink from 'next/link';
import type { ReactNode } from 'react';
import styles from './ButtonLink.module.css';

type Props = {
  href: string;
  children: ReactNode;
  variant?: 'solid' | 'outline';
  color?: 'primary' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  /**
   * Next 라우터를 거치지 않는 일반 a로 이동한다.
   * Route Handler(로그인 등)나 외부 주소는 프리페치하면 안 되므로 true로 준다.
   */
  native?: boolean;
};

/**
 * 버튼처럼 보이는 링크. @bestow-ui/react Button은 asChild를 받지 않아,
 * 페이지 이동에 쓸 수 있도록 Button과 같은 토큰으로 스타일을 맞췄다.
 */
export function ButtonLink({ href, children, variant = 'solid', color = 'primary', size = 'md', native }: Props) {
  const className = [styles.button, styles[variant], styles[color], styles[size]].join(' ');
  return native ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <NextLink href={href} className={className}>
      {children}
    </NextLink>
  );
}
