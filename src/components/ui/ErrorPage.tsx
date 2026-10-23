'use client';

import { Button, Stack, Typography } from '@bestow-ui/react';
import { Page } from './Page';

/** error.tsx에서 쓰는 오류 화면 */
export function ErrorPage({
  title,
  description = 'GitHub 응답이 늦거나 일시적인 문제가 있을 수 있어요. 잠시 후 다시 시도해 주세요.',
  retry,
}: {
  title: string;
  description?: string;
  retry: () => void;
}) {
  return (
    <Page>
      <Stack gap={4} align="start">
        <Typography variant="h2" as="h1">
          {title}
        </Typography>
        <Typography variant="body-sm" color="muted">
          {description}
        </Typography>
        <Button onClick={retry}>다시 시도</Button>
      </Stack>
    </Page>
  );
}
