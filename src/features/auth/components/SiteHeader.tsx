import { Avatar, Button, Container, Link, Stack, Typography } from '@bestow-ui/react';
import NextLink from 'next/link';
import { Suspense } from 'react';
import { getSession } from '@/server/session';
import styles from './SiteHeader.module.css';

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Container size="md">
        <Stack direction="row" align="center" justify="between" className={styles.bar}>
          {/* 서버 컴포넌트에서는 함수를 넘길 수 없어 as 대신 asChild로 Next 링크를 감싼다. */}
          <Link asChild color="inherit" underline="hover">
            <NextLink href="/" className={styles.logo}>
              shipped
            </NextLink>
          </Link>
          {/* 세션은 요청 시점에 읽으므로 정적 셸과 분리해 스트리밍한다. */}
          <Suspense fallback={null}>
            <UserMenu />
          </Suspense>
        </Stack>
      </Container>
    </header>
  );
}

async function UserMenu() {
  const session = await getSession();
  if (!session) return null;

  const displayName = session.user.name ?? session.user.login;
  return (
    <Stack direction="row" align="center" gap={3}>
      <Avatar src={session.user.avatarUrl} name={displayName} alt="" size="sm" />
      <Typography variant="body-sm" weight="medium" as="span">
        {displayName}
      </Typography>
      <form action="/api/auth/logout" method="post">
        <Button type="submit" variant="outline" color="neutral" size="sm">
          로그아웃
        </Button>
      </form>
    </Stack>
  );
}
