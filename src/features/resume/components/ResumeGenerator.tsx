'use client';

import { Alert, Badge, Button, Card, Stack, Typography } from '@bestow-ui/react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ButtonLink } from '@/components/ui/ButtonLink';
import type { ContributionCommit } from '@/features/repos/lib/contribution';
import { useResumeDraft } from '../hooks/useResumeDraft';
import { AnalysisSteps } from './AnalysisSteps';
import type { ResumeDraft } from '../lib/draft';
import { parsePartialDraft } from '../lib/partialDraft';
import {
  acceptAllPending,
  countBlanks,
  countReview,
  draftToMarkdown,
  keptAchievements,
  type DraftReview as DraftReviewState,
} from '../lib/review';
import { MAX_RESUME_COMMITS, type ResumeRequest } from '../lib/schema';
import { DraftPreview, DraftReview, type CommitLookup } from './DraftReview';
import { PrintableResume } from './PrintableResume';

const numberFormatter = new Intl.NumberFormat('ko-KR');

type Props = {
  projectName: string;
  commits: readonly ContributionCommit[];
  share?: ResumeRequest['share'];
};

/** 본인 커밋으로 경력기술서 초안을 스트리밍 생성하고, 문장마다 수락·수정·거절한다. */
export function ResumeGenerator({ projectName, commits, share }: Props) {
  const { state, generate, stop } = useResumeDraft();
  const [review, setReview] = useState<DraftReviewState>({});
  // 최신 커밋부터 상한까지만 보낸다. GitHub 수집 상한과 같아서 보통은 전부 들어간다.
  const sent = useMemo(
    () => [...commits].sort((a, b) => Date.parse(b.authoredAt) - Date.parse(a.authoredAt)).slice(0, MAX_RESUME_COMMITS),
    [commits],
  );
  const lookup: CommitLookup = useMemo(
    () =>
      new Map(sent.map(commit => [commit.sha.slice(0, 7), { headline: commit.headline, url: commit.url }] as const)),
    [sent],
  );

  function start() {
    setReview({});
    void generate({
      projectName,
      share,
      commits: sent.map(({ sha, message, authoredAt, lineStats }) => ({ sha, message, authoredAt, lineStats })),
    });
  }

  const isStreaming = state.status === 'streaming';
  const text = state.status === 'idle' ? '' : state.text;
  // 완성 전에는 덜 완성된 JSON을 읽어 다 쓴 문장부터 보여 준다.
  const partial = useMemo(() => (state.status === 'done' ? null : parsePartialDraft(text)), [state.status, text]);

  return (
    <Card as="section" variant="outline" padding="md" aria-labelledby="resume-title">
      <Stack gap={5}>
        <Stack direction={{ base: 'column', md: 'row' }} justify="between" align={{ base: 'start', md: 'center' }} gap={3}>
          <Stack gap={1}>
            <Stack direction="row" align="center" gap={2}>
              <Typography id="resume-title" variant="h4" as="h2">
                경력기술서 초안
              </Typography>
              {state.status !== 'idle' && state.mock && (
                <Badge variant="soft" color="warning" size="sm">
                  개발용 가짜 응답
                </Badge>
              )}
            </Stack>
            <Typography variant="body-sm" color="muted">
              커밋 {numberFormatter.format(sent.length)}개의 메시지·변경 파일 경로·통계만 Claude에 보내요. 코드 내용은 보내지 않아요.
            </Typography>
          </Stack>
          {isStreaming ? (
            <Button variant="outline" color="neutral" onClick={stop}>
              멈추기
            </Button>
          ) : (
            <Button onClick={start}>{state.status === 'idle' ? '초안 만들기' : '다시 만들기'}</Button>
          )}
        </Stack>

        {state.status === 'error' && (
          <Alert
            color="danger"
            role="alert"
            action={
              state.loginRequired ? (
                <ButtonLink href="/api/auth/login" size="sm" native>
                  GitHub로 로그인
                </ButtonLink>
              ) : undefined
            }
          >
            {state.message}
          </Alert>
        )}

        {state.status !== 'idle' && state.steps.length > 0 && (
          <AnalysisSteps steps={state.steps} active={isStreaming} />
        )}

        {state.status === 'done' ? (
          <>
            <ReviewToolbar
              projectName={projectName}
              draft={state.draft}
              review={review}
              onAcceptAll={() => setReview(prev => acceptAllPending(state.draft, prev))}
            />
            <DraftReview
              draft={state.draft}
              review={review}
              onReviewChange={(key, next) => setReview(prev => ({ ...prev, [key]: next }))}
              commits={lookup}
            />
            {/* 인쇄할 때 다른 화면을 통째로 숨길 수 있도록 body 바로 아래에 둔다. */}
            {createPortal(<PrintableResume projectName={projectName} draft={state.draft} review={review} />, document.body)}
            <Typography variant="caption" color="subtle">
              노란색으로 표시한 칸은 커밋으로 확인할 수 없는 내용이에요. 직접 채워 주세요.
              {!state.mock &&
                ` · 입력 ${numberFormatter.format(state.usage.inputTokens + state.usage.cacheReadTokens)}토큰(캐시 ${numberFormatter.format(state.usage.cacheReadTokens)}) · 출력 ${numberFormatter.format(state.usage.outputTokens)}토큰`}
            </Typography>
          </>
        ) : (
          // 스트리밍 중에는 스크린리더가 문장마다 읽지 않도록 다 쓴 뒤에만 알린다.
          partial && (
            <div aria-busy={isStreaming}>
              <DraftPreview draft={partial} commits={lookup} />
            </div>
          )
        )}

        {state.status === 'stopped' && (
          <Typography variant="caption" color="muted" role="status">
            생성을 멈췄어요. 다시 만들기를 누르면 처음부터 새로 써요.
          </Typography>
        )}
      </Stack>
    </Card>
  );
}

/** 검토 집계와 일괄 동작 */
function ReviewToolbar({
  projectName,
  draft,
  review,
  onAcceptAll,
}: {
  projectName: string;
  draft: ResumeDraft;
  review: DraftReviewState;
  onAcceptAll: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const counts = countReview(draft, review);
  const kept = counts.accepted + counts.edited;
  const blanks = countBlanks([
    draft.summary.overview,
    draft.summary.period,
    draft.summary.role,
    ...keptAchievements(draft, review).flatMap(achievement => achievement.sentences.map(sentence => sentence.text)),
  ]);

  /** 브라우저 인쇄 창을 연다. 저장할 PDF 파일 이름이 되도록 인쇄하는 동안만 문서 제목을 바꾼다. */
  function print() {
    const previousTitle = document.title;
    document.title = `${projectName} 경력기술서`;
    window.addEventListener('afterprint', () => (document.title = previousTitle), { once: true });
    window.print();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draftToMarkdown(projectName, draft, review));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없으면 복사할 수 없다. 버튼 문구는 그대로 둔다.
    }
  }

  return (
    <Stack direction={{ base: 'column', md: 'row' }} justify="between" align={{ base: 'start', md: 'center' }} gap={3}>
      <Stack gap={1}>
        <Typography variant="body-sm" color="muted" role="status">
          수락 {counts.accepted} · 수정 {counts.edited} · 거절 {counts.rejected} · 남음 {counts.pending}
        </Typography>
        {kept > 0 && blanks > 0 && (
          <Typography variant="caption" color="warning">
            수락한 문장에 채우지 않은 칸이 {blanks}개 있어요. 수정으로 채운 뒤 저장하세요.
          </Typography>
        )}
      </Stack>
      <Stack direction="row" gap={2} wrap>
        <Button size="sm" variant="outline" color="neutral" onClick={onAcceptAll} disabled={counts.pending === 0}>
          남은 문장 모두 수락
        </Button>
        <Button size="sm" variant="outline" color="neutral" onClick={copy} disabled={kept === 0}>
          {copied ? '복사됨' : `수락한 문장 ${kept}개 복사`}
        </Button>
        <Button size="sm" onClick={print} disabled={kept === 0}>
          PDF로 저장
        </Button>
      </Stack>
    </Stack>
  );
}
