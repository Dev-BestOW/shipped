import { Page, PageHeader } from '@/components/ui/Page';
import { LocalLogUpload } from '@/features/repos/components/LocalLogUpload';

export const metadata = { title: 'git log로 분석 · shipped' };

export default function LocalLogPage() {
  return (
    <Page>
      <PageHeader
        title="git log로 분석하기"
        description="회사 GitLab처럼 GitHub에 연결할 수 없는 레포도 커밋 기록 파일만 있으면 분석할 수 있어요."
      />
      <LocalLogUpload />
    </Page>
  );
}
