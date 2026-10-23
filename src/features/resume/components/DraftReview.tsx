'use client';

import { Badge, Button, Card, Link, Stack, Textarea, Tooltip, Typography } from '@bestow-ui/react';
import { useState, type ReactNode } from 'react';
import { SENTENCE_KIND_LABEL, type DraftSentence, type ResumeDraft } from '../lib/draft';
import type { PartialDraft } from '../lib/partialDraft';
import { getReview, sentenceKey, type DraftReview as Review, type SentenceReview } from '../lib/review';
import styles from './DraftReview.module.css';

/** 근거 칩에 보여 줄 커밋 정보. 키는 짧은 해시(7자) */
export type CommitLookup = ReadonlyMap<string, { headline: string; url: string | null }>;

const KIND_COLOR = { problem: 'warning', solution: 'info', result: 'success' } as const;

/** 스트리밍 중인 초안. 다 쓴 문장부터 하나씩 나타나고, 검토 버튼은 없다. */
export function DraftPreview({ draft, commits }: { draft: PartialDraft; commits: CommitLookup }) {
  return (
    <Stack gap={5}>
      <SummaryBlock summary={draft.summary} />
      {draft.achievements.map((achievement, a) => (
        <Stack key={a} as="section" gap={2}>
          {achievement.title && (
            <Typography variant="h4" as="h3">
              {achievement.title}
            </Typography>
          )}
          {achievement.sentences.map((sentence, s) =>
            sentence.kind && sentence.text ? (
              <Stack key={s} direction="row" gap={2} align="baseline">
                <KindBadge kind={sentence.kind} />
                <Stack gap={1}>
                  <SentenceText text={sentence.text} />
                  {sentence.evidence && <EvidenceChips shas={sentence.evidence} commits={commits} />}
                </Stack>
              </Stack>
            ) : null,
          )}
        </Stack>
      ))}
    </Stack>
  );
}

/** 완성된 초안. 문장마다 수락·수정·거절한다. */
export function DraftReview({
  draft,
  review,
  onReviewChange,
  commits,
}: {
  draft: ResumeDraft;
  review: Review;
  onReviewChange: (key: string, next: SentenceReview) => void;
  commits: CommitLookup;
}) {
  return (
    <Stack gap={6}>
      <SummaryBlock summary={draft.summary} />
      {draft.achievements.map((achievement, a) => (
        <Stack key={a} as="section" gap={3}>
          <Typography variant="h4" as="h3">
            {achievement.title}
          </Typography>
          <Stack as="ul" gap={2} className={styles.sentences}>
            {achievement.sentences.map((sentence, s) => {
              const key = sentenceKey(a, s);
              return (
                <SentenceRow
                  key={key}
                  sentence={sentence}
                  review={getReview(review, key)}
                  onChange={next => onReviewChange(key, next)}
                  commits={commits}
                />
              );
            })}
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}

function SentenceRow({
  sentence,
  review,
  onChange,
  commits,
}: {
  sentence: DraftSentence;
  review: SentenceReview;
  onChange: (next: SentenceReview) => void;
  commits: CommitLookup;
}) {
  const [editing, setEditing] = useState(false);
  const text = review.status === 'edited' ? review.text : sentence.text;
  const [value, setValue] = useState(text);

  function startEdit() {
    setValue(text);
    setEditing(true);
  }

  function save() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onChange(trimmed === sentence.text ? { status: 'accepted' } : { status: 'edited', text: trimmed });
    setEditing(false);
  }

  return (
    <Card as="li" variant="outline" padding="sm" className={styles.row} data-status={review.status}>
      <Stack direction={{ base: 'column', md: 'row' }} gap={3} justify="between" align={{ base: 'stretch', md: 'start' }}>
        <Stack direction="row" gap={2} align="baseline" className={styles.body}>
          <KindBadge kind={sentence.kind} />
          <Stack gap={2} className={styles.body}>
            {editing ? (
              <Textarea
                aria-label={`${SENTENCE_KIND_LABEL[sentence.kind]} 문장 고치기`}
                value={value}
                onChange={event => setValue(event.target.value)}
                autoResize
                autoFocus
              />
            ) : (
              <SentenceText text={text} rejected={review.status === 'rejected'} />
            )}
            <Stack direction="row" gap={2} align="center" wrap>
              <EvidenceChips shas={sentence.evidence} commits={commits} />
              {review.status === 'edited' && (
                <Badge variant="outline" color="neutral" size="sm">
                  수정됨
                </Badge>
              )}
            </Stack>
          </Stack>
        </Stack>

        <Stack direction="row" gap={1} justify="end" className={styles.actions}>
          {editing ? (
            <>
              <Button size="sm" variant="ghost" color="neutral" onClick={() => setEditing(false)}>
                취소
              </Button>
              <Button size="sm" onClick={save} disabled={!value.trim()}>
                저장
              </Button>
            </>
          ) : review.status === 'pending' ? (
            <>
              <Button size="sm" variant="soft" onClick={() => onChange({ status: 'accepted' })}>
                수락
              </Button>
              <Button size="sm" variant="ghost" color="neutral" onClick={startEdit}>
                수정
              </Button>
              <Button size="sm" variant="ghost" color="danger" onClick={() => onChange({ status: 'rejected' })}>
                거절
              </Button>
            </>
          ) : (
            <>
              <Typography as="span" variant="caption" color={review.status === 'rejected' ? 'danger' : 'success'}>
                {review.status === 'rejected' ? '거절함' : '수락함'}
              </Typography>
              {review.status !== 'rejected' && (
                <Button size="sm" variant="ghost" color="neutral" onClick={startEdit}>
                  수정
                </Button>
              )}
              <Button size="sm" variant="ghost" color="neutral" onClick={() => onChange({ status: 'pending' })}>
                되돌리기
              </Button>
            </>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

function SummaryBlock({ summary }: { summary: PartialDraft['summary'] }) {
  const items: [string, ReactNode][] = [
    ['기간', summary.period && <SentenceText text={summary.period} />],
    ['역할', summary.role && <SentenceText text={summary.role} />],
    [
      '기술',
      summary.techStack.length > 0 && (
        <Stack direction="row" gap={1} wrap>
          {summary.techStack.map(tech => (
            <Badge key={tech} variant="soft" color="neutral" size="sm">
              {tech}
            </Badge>
          ))}
        </Stack>
      ),
    ],
  ];

  return (
    <Stack gap={2}>
      {summary.overview && (
        <Typography weight="medium">
          <SentenceText text={summary.overview} />
        </Typography>
      )}
      <dl className={styles.summary}>
        {items.map(([label, value]) =>
          value ? (
            <div key={label} className={styles.summaryItem}>
              <Typography as="dt" variant="caption" color="muted">
                {label}
              </Typography>
              <Typography as="dd" variant="body-sm" className={styles.summaryValue}>
                {value}
              </Typography>
            </div>
          ) : null,
        )}
      </dl>
    </Stack>
  );
}

function KindBadge({ kind }: { kind: DraftSentence['kind'] }) {
  return (
    <Badge variant="soft" color={KIND_COLOR[kind]} size="sm" className={styles.kind}>
      {SENTENCE_KIND_LABEL[kind]}
    </Badge>
  );
}

/** [N]·[역할]처럼 사용자가 채워야 할 칸을 강조한다. */
function SentenceText({ text, rejected = false }: { text: string; rejected?: boolean }) {
  const parts = text.split(/(\[[^\]]+\])/);
  return (
    <Typography as="span" variant="body-sm" className={rejected ? styles.rejected : undefined}>
      {parts.map((part, i) =>
        /^\[[^\]]+\]$/.test(part) ? (
          <mark key={i} className={styles.blank} title="커밋으로 확인할 수 없어 비워 둔 칸이에요. 직접 채워 주세요.">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </Typography>
  );
}

/** 근거 커밋. 마우스를 올리거나 포커스하면 커밋 제목이 보이고, GitHub 커밋은 누르면 열린다. */
function EvidenceChips({ shas, commits }: { shas: readonly string[]; commits: CommitLookup }) {
  if (shas.length === 0) {
    return (
      <Badge variant="soft" color="warning" size="sm">
        근거 없음
      </Badge>
    );
  }
  return (
    <Stack as="span" direction="row" gap={1} wrap aria-label="근거 커밋">
      {shas.map(sha => {
        const commit = commits.get(sha);
        const chip = commit?.url ? (
          <Link href={commit.url} target="_blank" rel="noopener noreferrer" color="neutral" className={styles.sha}>
            {sha}
          </Link>
        ) : (
          <span className={styles.sha} tabIndex={0}>
            {sha}
          </span>
        );
        return commit ? (
          <Tooltip key={sha} content={commit.headline}>
            {chip}
          </Tooltip>
        ) : (
          <span key={sha}>{chip}</span>
        );
      })}
    </Stack>
  );
}
