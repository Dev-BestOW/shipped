'use client';

import { Alert, Badge, Button, Card, Stack, Typography } from '@bestow-ui/react';
import { useState } from 'react';
import { ButtonLink } from '@/components/ui/ButtonLink';
import type { ContributionCommit } from '@/features/repos/lib/contribution';
import { useResumeDraft } from '../hooks/useResumeDraft';
import { AnalysisSteps } from './AnalysisSteps';
import { MAX_RESUME_COMMITS, type ResumeRequest } from '../lib/schema';
import styles from './ResumeGenerator.module.css';

const numberFormatter = new Intl.NumberFormat('ko-KR');

type Props = {
  projectName: string;
  commits: readonly ContributionCommit[];
  share?: ResumeRequest['share'];
};

/** 본인 커밋으로 경력기술서 초안을 스트리밍 생성한다. */
export function ResumeGenerator({ projectName, commits, share }: Props) {
  const { state, generate, stop } = useResumeDraft();
  // 최신 커밋부터 상한까지만 보낸다. GitHub 수집 상한과 같아서 보통은 전부 들어간다.
  const sent = [...commits]
    .sort((a, b) => Date.parse(b.authoredAt) - Date.parse(a.authoredAt))
    .slice(0, MAX_RESUME_COMMITS);

  function start() {
    void generate({
      projectName,
      share,
      commits: sent.map(({ sha, message, authoredAt, lineStats }) => ({ sha, message, authoredAt, lineStats })),
    });
  }

  const isStreaming = state.status === 'streaming';
  const text = state.status === 'idle' ? '' : state.text;

  return (
    <Card as="section" variant="outline" padding="md" aria-labelledby="resume-title">
      <Stack gap={4}>
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

        {text && <DraftText text={text} streaming={isStreaming} />}

        {state.status === 'done' && (
          <Stack gap={2}>
            {state.truncated && (
              <Alert color="warning">글이 너무 길어 중간에 끊겼어요. 다시 만들어 주세요.</Alert>
            )}
            <Typography variant="caption" color="subtle">
              [N]과 [ ]로 남긴 칸은 커밋으로 확인할 수 없는 내용이에요. 직접 채워 주세요.
              {!state.mock &&
                ` · 입력 ${numberFormatter.format(state.usage.inputTokens + state.usage.cacheReadTokens)}토큰(캐시 ${numberFormatter.format(state.usage.cacheReadTokens)}) · 출력 ${numberFormatter.format(state.usage.outputTokens)}토큰`}
            </Typography>
          </Stack>
        )}
        {state.status === 'stopped' && (
          <Typography variant="caption" color="muted" role="status">
            생성을 멈췄어요.
          </Typography>
        )}
      </Stack>
    </Card>
  );
}

function DraftText({ text, streaming }: { text: string; streaming: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없으면 사용자가 직접 선택해 복사할 수 있다.
    }
  }

  return (
    <Stack gap={2}>
      {/* 스트리밍 중에는 스크린리더가 글자마다 읽지 않도록 다 쓴 뒤에만 알린다. */}
      <div className={styles.draft} aria-busy={streaming}>
        {text}
      </div>
      {!streaming && (
        <Stack direction="row" justify="end">
          <Button variant="ghost" color="neutral" size="sm" onClick={copy}>
            {copied ? '복사됨' : '마크다운 복사'}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
