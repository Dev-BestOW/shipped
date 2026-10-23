'use client';

import { Alert, Button, Checkbox, FileUpload, Stack, TextField, Typography } from '@bestow-ui/react';
import { useMemo, useState, type ReactNode } from 'react';
import { DividedList, DividedListItem } from '@/components/ui/DividedList';
import { EmptyState } from '@/components/ui/Page';
import { summarizeContribution } from '../lib/contribution';
import {
  GIT_LOG_COMMAND,
  decodeGitLogFile,
  MAX_GIT_LOG_BYTES,
  listGitLogAuthors,
  parseGitLog,
  type LocalCommit,
} from '../lib/git-log';
import { ResumeGenerator } from '@/features/resume/components/ResumeGenerator';
import { ContributionReport } from './ContributionReport';
import styles from './LocalLogUpload.module.css';

type UploadState =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'error'; message: string }
  | { status: 'parsed'; fileName: string; commits: LocalCommit[]; skipped: number };

export function LocalLogUpload() {
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const [selectedEmails, setSelectedEmails] = useState<ReadonlySet<string>>(new Set());

  async function handleFiles(files: File[]) {
    setSelectedEmails(new Set());
    const file = files[0];
    // 목록에서 파일을 지운 경우
    if (!file) {
      setState({ status: 'idle' });
      return;
    }

    setState({ status: 'reading' });
    try {
      const { commits, skipped } = parseGitLog(decodeGitLogFile(await file.arrayBuffer()));
      if (commits.length === 0) {
        setState({
          status: 'error',
          message: '커밋을 찾지 못했어요. 위 명령으로 만든 파일인지 확인해 주세요.',
        });
        return;
      }
      setState({ status: 'parsed', fileName: file.name, commits, skipped });
    } catch {
      setState({ status: 'error', message: '파일을 읽지 못했어요. 다시 시도해 주세요.' });
    }
  }

  return (
    <Stack gap={8}>
      <ol className={styles.steps}>
        <Step number={1} title="분석할 레포 폴더에서 아래 명령을 실행해 주세요">
          <CommandBox command={GIT_LOG_COMMAND} />
          <Typography variant="caption" color="muted">
            커밋 메시지, 작성자, 날짜, 파일별 변경 줄 수만 담겨요. 코드 내용은 들어가지 않아요.
          </Typography>
        </Step>
        <Step number={2} title="만들어진 shipped-log.txt 파일을 올려 주세요">
          <FileUpload
            accept=".txt,.log,text/plain"
            maxSize={MAX_GIT_LOG_BYTES}
            onValueChange={handleFiles}
            helperText="30MB까지 올릴 수 있어요. 파일은 브라우저 안에서만 읽고, 서버로 보내거나 저장하지 않아요."
          />
          <UploadStatus state={state} />
        </Step>
      </ol>

      {state.status === 'parsed' && (
        <ParsedResult
          commits={state.commits}
          selectedEmails={selectedEmails}
          onSelectedEmailsChange={setSelectedEmails}
        />
      )}
    </Stack>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <li className={styles.step}>
      <span className={styles.stepNumber} aria-hidden>
        {number}
      </span>
      <Stack gap={3} className={styles.stepBody}>
        <Typography weight="semibold">{title}</Typography>
        {children}
      </Stack>
    </li>
  );
}

function CommandBox({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없으면 사용자가 직접 선택해 복사할 수 있다.
    }
  }

  return (
    <Stack direction="row" align="start" gap={2} className={styles.command}>
      <code className={styles.commandText}>{command}</code>
      <Button variant="outline" color="neutral" size="sm" onClick={copy}>
        {copied ? '복사됨' : '복사'}
      </Button>
    </Stack>
  );
}

function UploadStatus({ state }: { state: UploadState }) {
  switch (state.status) {
    case 'idle':
      return null;
    case 'reading':
      return (
        <Typography variant="body-sm" color="muted" role="status">
          파일을 읽는 중이에요…
        </Typography>
      );
    case 'error':
      return (
        <Alert color="danger" role="alert">
          {state.message}
        </Alert>
      );
    case 'parsed':
      return (
        <Typography variant="body-sm" color="muted" role="status">
          {state.fileName}에서 커밋 {state.commits.length.toLocaleString('ko-KR')}개를 읽었어요.
          {state.skipped > 0 && ` 형식이 맞지 않는 ${state.skipped.toLocaleString('ko-KR')}개는 건너뛰었어요.`}
        </Typography>
      );
  }
}

function ParsedResult({
  commits,
  selectedEmails,
  onSelectedEmailsChange,
}: {
  commits: LocalCommit[];
  selectedEmails: ReadonlySet<string>;
  onSelectedEmailsChange: (emails: ReadonlySet<string>) => void;
}) {
  const authors = useMemo(() => listGitLogAuthors(commits), [commits]);
  const myCommits = useMemo(
    () => commits.filter(commit => selectedEmails.has(commit.authorEmail)),
    [commits, selectedEmails],
  );
  const summary = useMemo(() => summarizeContribution(myCommits), [myCommits]);
  const [projectName, setProjectName] = useState('');

  function toggle(email: string, checked: boolean) {
    const next = new Set(selectedEmails);
    if (checked) {
      next.add(email);
    } else {
      next.delete(email);
    }
    onSelectedEmailsChange(next);
  }

  return (
    <Stack gap={8}>
      <fieldset className={styles.fieldset}>
        <Stack gap={3}>
          <Typography as="legend" variant="h4" className={styles.legend}>
            내 이메일을 골라 주세요
          </Typography>
          <Typography variant="body-sm" color="muted">
            회사 메일과 개인 메일처럼 여러 개를 썼다면 모두 골라 주세요. 고른 이메일로 작성한 커밋만 분석해요.
          </Typography>
          <DividedList>
            {authors.map(author => (
              <DividedListItem key={author.email}>
                <Checkbox
                  checked={selectedEmails.has(author.email)}
                  onCheckedChange={checked => toggle(author.email, checked)}
                  label={
                    <Stack as="span" gap={0}>
                      <Typography as="span" variant="body-sm" weight="medium">
                        {author.names.join(', ')} · 커밋 {author.commitCount.toLocaleString('ko-KR')}개
                      </Typography>
                      <Typography as="span" variant="caption" color="muted">
                        {author.email}
                      </Typography>
                    </Stack>
                  }
                />
              </DividedListItem>
            ))}
          </DividedList>
        </Stack>
      </fieldset>

      {selectedEmails.size > 0 ? (
        <>
          <ContributionReport
            summary={summary}
            commits={myCommits}
            share={{ mine: myCommits.length, total: commits.length }}
            emptyHint="고른 이메일로 작성한 커밋이 없어요."
          />
          {myCommits.length > 0 && (
            <Stack gap={4}>
              <TextField
                label="프로젝트 이름"
                helperText="경력기술서에 쓸 이름이에요. 비워 두면 '이름 없는 프로젝트'로 보내요."
                value={projectName}
                onChange={event => setProjectName(event.target.value)}
                maxLength={200}
              />
              <ResumeGenerator
                projectName={projectName.trim() || '이름 없는 프로젝트'}
              commits={myCommits}
                share={{ mine: myCommits.length, total: commits.length }}
              />
            </Stack>
          )}
        </>
      ) : (
        <EmptyState title="이메일을 고르면 기여 분석 결과가 여기에 나와요." />
      )}
    </Stack>
  );
}
