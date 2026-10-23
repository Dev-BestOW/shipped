'use client';

import { Spinner, Stack, Stepper, Typography, VisuallyHidden } from '@bestow-ui/react';
import type { AnalysisStep } from '../hooks/useResumeDraft';

/** 결과 요약과 걸린 시간. 1초 미만은 시간을 생략한다. */
function describeStep(step: AnalysisStep, active: boolean): string {
  if (step.status === 'running') return active ? '진행 중…' : '멈춤';
  const seconds = step.finishedAt === undefined ? 0 : Math.round((step.finishedAt - step.startedAt) / 1000);
  return [step.detail, seconds >= 1 ? `${seconds}초` : null].filter(Boolean).join(' · ') || '완료';
}

/**
 * Claude가 초안을 쓰기까지 거친 분석 단계. 단계는 도착하는 대로 늘어난다.
 * Stepper에는 진행 중(로딩) 표시가 없어서, active일 때 지금 단계 이름을 스피너와 함께 따로 보여 준다.
 */
export function AnalysisSteps({ steps, active }: { steps: readonly AnalysisStep[]; active: boolean }) {
  const runningIndex = steps.findIndex(step => step.status === 'running');
  const running = runningIndex === -1 ? undefined : steps[runningIndex];

  return (
    <Stack gap={3}>
      <Stepper
        aria-label="분석 단계"
        orientation="vertical"
        // 세로 Stepper는 설명 유무에 따라 단계 높이가 달라져 간격이 들쭉날쭉해진다. 모든 단계에 한 줄 설명을 둔다.
        steps={steps.map(step => ({ label: step.label, description: describeStep(step, active) }))}
        current={runningIndex === -1 ? steps.length : runningIndex}
      />
      {active && running && (
        <Stack direction="row" align="center" gap={2}>
          <Spinner size="sm" label="" />
          <Typography variant="caption" color="muted">
            {running.label} 중이에요. 초안이 나오기까지 1분쯤 걸릴 수 있어요.
          </Typography>
        </Stack>
      )}
      {/* 스크린리더에는 단계가 바뀔 때마다 지금 하는 일만 알린다. */}
      <VisuallyHidden role="status">{active && running ? `${running.label} 중` : ''}</VisuallyHidden>
    </Stack>
  );
}
