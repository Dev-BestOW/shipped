'use client';

import { ErrorPage } from '@/components/ui/ErrorPage';

export default function RepoContributionError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorPage title="커밋을 불러오지 못했어요" retry={retry} />;
}
