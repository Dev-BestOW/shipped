import { Skeleton, Stack, VisuallyHidden } from '@bestow-ui/react';
import { Page } from '@/components/ui/Page';

export default function Loading() {
  return (
    <Page aria-busy="true">
      <Skeleton variant="rect" width={128} height={32} />
      <Stack gap={3}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} variant="rect" height={64} />
        ))}
      </Stack>
      <VisuallyHidden>레포 목록을 불러오는 중이에요.</VisuallyHidden>
    </Page>
  );
}
