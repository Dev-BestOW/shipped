import { Container, Stack, Typography } from '@bestow-ui/react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Page.module.css';

/** 페이지 본문 틀. SkipLink가 건너뛸 곳(#main)이다. */
export function Page({ children, ...rest }: { children: ReactNode } & HTMLAttributes<HTMLElement>) {
  return (
    <Container as="main" id="main" size="md" className={styles.page} {...rest}>
      <Stack gap={6}>{children}</Stack>
    </Container>
  );
}

/** 페이지 제목과 설명. action은 오른쪽(좁은 화면에서는 아래)에 둔다. */
export function PageHeader({
  title,
  description,
  action,
  before,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** 제목 위에 둘 요소 (뒤로 가기 링크 등) */
  before?: ReactNode;
}) {
  return (
    <Stack direction={{ base: 'column', md: 'row' }} align={{ base: 'start', md: 'end' }} justify="between" gap={4}>
      <Stack gap={2}>
        {before}
        <Typography variant="h2" as="h1">
          {title}
        </Typography>
        {description && (
          <Typography variant="body-sm" color="muted">
            {description}
          </Typography>
        )}
      </Stack>
      {action}
    </Stack>
  );
}

/** 보여 줄 내용이 없을 때의 안내 상자 */
export function EmptyState({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <Stack gap={3} align="start" className={styles.empty}>
      <Typography weight="semibold">{title}</Typography>
      {children}
    </Stack>
  );
}
