'use client';

import { ErrorPage } from '@/components/ui/ErrorPage';

export default function ReposError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorPage title="레포 목록을 불러오지 못했어요" retry={retry} />;
}
