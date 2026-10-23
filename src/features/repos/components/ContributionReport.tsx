import { Alert, Card, Grid, Link, Skeleton, Stack, Typography } from '@bestow-ui/react';
import type { ReactNode } from 'react';
import { DividedList, DividedListItem } from '@/components/ui/DividedList';
import { EmptyState } from '@/components/ui/Page';
import type { ContributionCommit, ContributionSummary, LineStats } from '../lib/contribution';
import styles from './ContributionReport.module.css';

/** 처음에 펼쳐 보여 줄 커밋 수. 나머지는 접어 둔다. */
const VISIBLE_COMMITS = 30;

// 서버와 브라우저에서 같은 결과가 나오도록 시간대를 고정한다.
const dateFormatter = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' });
const numberFormatter = new Intl.NumberFormat('ko-KR');
const percentFormatter = new Intl.NumberFormat('ko-KR', { style: 'percent', maximumFractionDigits: 1 });

type Props = {
  summary: ContributionSummary;
  commits: readonly ContributionCommit[];
  /** 레포 전체 커밋 중 내 커밋 비중. 전체 커밋 수를 알 수 없으면 생략한다. */
  share?: { mine: number; total: number };
  /** 커밋이 많아 일부만 분석했으면 안내 문구를 보여 준다. */
  truncatedNote?: string;
  /** 내 커밋이 없을 때 보여 줄 도움말 */
  emptyHint?: string;
};

export function ContributionReport({
  summary,
  commits,
  share,
  truncatedNote,
  emptyHint = '커밋 작성자 이메일이 GitHub 계정에 등록돼 있는지 확인해 주세요. 머지 커밋은 분석에서 빠져요.',
}: Props) {
  if (summary.commitCount === 0) {
    return (
      <EmptyState title="내가 작성한 커밋을 찾지 못했어요.">
        <Typography variant="body-sm" color="muted">
          {emptyHint}
        </Typography>
      </EmptyState>
    );
  }

  const newestFirst = [...commits].sort((a, b) => Date.parse(b.authoredAt) - Date.parse(a.authoredAt));
  const visible = newestFirst.slice(0, VISIBLE_COMMITS);
  const hidden = newestFirst.slice(VISIBLE_COMMITS);

  return (
    <Stack gap={6}>
      <Grid as="dl" columns={{ base: 2, md: 4 }} gap={3} className={styles.stats}>
        <Stat label="내 커밋">{numberFormatter.format(summary.commitCount)}개</Stat>
        <Stat label="활동 기간">
          {summary.firstAt && summary.lastAt && (
            <Typography as="span" variant="body" weight="semibold">
              {dateFormatter.format(new Date(summary.firstAt))}
              <br />~ {dateFormatter.format(new Date(summary.lastAt))}
            </Typography>
          )}
        </Stat>
        <Stat label="활동한 달">{numberFormatter.format(summary.monthly.length)}개월</Stat>
        <Stat label="변경한 줄 (lockfile 제외)">
          {summary.lineTotals ? (
            <Typography as="span" variant="body" weight="semibold">
              <LineDelta stats={summary.lineTotals} />
            </Typography>
          ) : (
            <Stack as="span" gap={1} role="status">
              <Skeleton variant="rect" width={112} height={24} />
              <Typography as="span" variant="caption" color="muted">
                커밋마다 세는 중이에요…
              </Typography>
            </Stack>
          )}
        </Stat>
        {share && share.total > 0 && (
          <Stat label="전체 커밋 중 비중">
            {percentFormatter.format(share.mine / share.total)}
            <Typography as="span" variant="caption" color="muted" weight="regular" className={styles.block}>
              {numberFormatter.format(share.mine)} / {numberFormatter.format(share.total)}
            </Typography>
          </Stat>
        )}
      </Grid>

      {truncatedNote && <Alert color="warning">{truncatedNote}</Alert>}

      <Stack as="section" gap={3}>
        <Typography variant="h4" as="h2">
          내 커밋
        </Typography>
        <CommitList commits={visible} />
        {hidden.length > 0 && (
          <details className={styles.more}>
            <summary>
              <Typography as="span" variant="body-sm" weight="medium" color="muted">
                이전 커밋 {numberFormatter.format(hidden.length)}개 더 보기
              </Typography>
            </summary>
            <CommitList commits={hidden} />
          </details>
        )}
      </Stack>
    </Stack>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card variant="outline" padding="sm" className={styles.stat}>
      <Typography as="dt" variant="caption" color="muted">
        {label}
      </Typography>
      <Typography as="dd" variant="h3" weight="semibold" className={styles.statValue}>
        {children}
      </Typography>
    </Card>
  );
}

function LineDelta({ stats }: { stats: Pick<LineStats, 'additions' | 'deletions'> }) {
  return (
    <>
      <Typography as="span" color="success">
        +{numberFormatter.format(stats.additions)}
      </Typography>{' '}
      <Typography as="span" color="danger">
        −{numberFormatter.format(stats.deletions)}
      </Typography>
    </>
  );
}

function CommitList({ commits }: { commits: readonly ContributionCommit[] }) {
  return (
    <DividedList>
      {commits.map(commit => (
        <DividedListItem key={commit.sha}>
          <Stack direction={{ base: 'column', md: 'row' }} align={{ base: 'stretch', md: 'baseline' }} gap={{ base: 1, md: 4 }}>
            <Typography variant="body-sm" truncate title={commit.headline} className={styles.headline}>
              {commit.headline}
            </Typography>
            <Stack as="span" direction="row" align="baseline" gap={3}>
              <Typography as="span" variant="caption" color="muted">
                {commit.lineStats ? (
                  <LineDelta stats={commit.lineStats} />
                ) : (
                  <Skeleton variant="text" width={56} />
                )}
              </Typography>
              <Typography as="span" variant="caption" color="muted">
                <time dateTime={commit.authoredAt}>{dateFormatter.format(new Date(commit.authoredAt))}</time>
              </Typography>
              <Typography as="span" variant="caption" color="muted" className={styles.sha}>
                {commit.url ? (
                  <Link href={commit.url} target="_blank" rel="noopener noreferrer" color="inherit" underline="hover">
                    {commit.sha.slice(0, 7)}
                  </Link>
                ) : (
                  commit.sha.slice(0, 7)
                )}
              </Typography>
            </Stack>
          </Stack>
        </DividedListItem>
      ))}
    </DividedList>
  );
}
