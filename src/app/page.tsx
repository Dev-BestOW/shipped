import { Alert, Container, Skeleton, Stack, Typography } from '@bestow-ui/react';
import { Suspense } from 'react';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { getSession } from '@/server/session';

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'GitHub 로그인을 취소했어요.',
  invalid_state: '로그인 요청이 만료됐거나 올바르지 않아요. 다시 시도해 주세요.',
  missing_code: 'GitHub에서 인증 코드를 받지 못했어요. 다시 시도해 주세요.',
  login_failed: '로그인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
  session_expired: '로그인이 만료됐어요. 다시 로그인해 주세요.',
};

export default function Home({ searchParams }: PageProps<'/'>) {
  return (
    <Container as="main" id="main" size="md" style={{ paddingBlock: 96 }}>
      <Stack gap={8}>
        <Stack gap={4}>
          <Typography variant="display">shipped</Typography>
          <Typography variant="body-lg" color="muted">
            커밋 이력을 근거로 &ldquo;문제 → 해결 → 결과&rdquo; 형식의 경력기술서 초안을 만들어 드려요.
          </Typography>
        </Stack>

        {/* 세션과 searchParams는 요청 시점에 읽으므로 정적 셸과 분리해 스트리밍한다. */}
        <Suspense fallback={<Skeleton variant="rect" width={176} height={48} />}>
          <AuthAction searchParams={searchParams} />
        </Suspense>
      </Stack>
    </Container>
  );
}

async function AuthAction({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  const [session, { error }] = await Promise.all([getSession(), searchParams]);
  const errorMessage = typeof error === 'string' ? ERROR_MESSAGES[error] : undefined;

  return (
    <Stack gap={4} align="start">
      {errorMessage && (
        <Alert color="danger" role="alert">
          {errorMessage}
        </Alert>
      )}
      {session ? (
        <ButtonLink href="/repos" size="lg">
          내 레포 보기
        </ButtonLink>
      ) : (
        // Route Handler로 이동하므로 프리페치하지 않는 a를 쓴다.
        <ButtonLink href="/api/auth/login" size="lg" native>
          GitHub로 시작하기
        </ButtonLink>
      )}
    </Stack>
  );
}
