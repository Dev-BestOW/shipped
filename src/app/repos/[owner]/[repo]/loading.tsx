import { Grid, Skeleton, Stack, VisuallyHidden } from '@bestow-ui/react';
import { Page } from '@/components/ui/Page';

export default function Loading() {
  return (
    <Page aria-busy="true">
      <Skeleton variant="rect" width={224} height={32} />
      <Grid columns={{ base: 2, md: 4 }} gap={3}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} variant="rect" height={80} />
        ))}
      </Grid>
      <Stack gap={3}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} variant="rect" height={48} />
        ))}
      </Stack>
      <VisuallyHidden>커밋을 모으는 중이에요.</VisuallyHidden>
    </Page>
  );
}
