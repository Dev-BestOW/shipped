'use client';

import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { summarizeContribution } from '../lib/contribution';
import {
  GIT_LOG_COMMAND,
  decodeGitLogFile,
  MAX_GIT_LOG_BYTES,
  listGitLogAuthors,
  parseGitLog,
  type LocalCommit,
} from '../lib/git-log';
import { ContributionReport } from './ContributionReport';

type UploadState =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'error'; message: string }
  | { status: 'parsed'; fileName: string; commits: LocalCommit[]; skipped: number };

export function LocalLogUpload() {
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const [selectedEmails, setSelectedEmails] = useState<ReadonlySet<string>>(new Set());

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedEmails(new Set());

    if (file.size > MAX_GIT_LOG_BYTES) {
      setState({ status: 'error', message: '파일이 너무 커요. 30MB 이하로 올려 주세요.' });
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
    <div className="flex flex-col gap-8">
      <ol className="flex flex-col gap-6">
        <Step number={1} title="분석할 레포 폴더에서 아래 명령을 실행해 주세요">
          <CommandBox command={GIT_LOG_COMMAND} />
          <p className="text-xs text-zinc-500">
            커밋 메시지, 작성자, 날짜, 파일별 변경 줄 수만 담겨요. 코드 내용은 들어가지 않아요.
          </p>
        </Step>
        <Step number={2} title="만들어진 shipped-log.txt 파일을 올려 주세요">
          <label className="flex w-fit cursor-pointer items-center gap-3 rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">
            파일 선택
            <input type="file" accept=".txt,.log,text/plain" onChange={handleFile} className="sr-only" />
          </label>
          <p className="text-xs text-zinc-500">파일은 브라우저 안에서만 읽어요. 서버로 보내거나 저장하지 않아요.</p>
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
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
        {number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="font-medium">{title}</p>
        {children}
      </div>
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
    <div className="flex items-start gap-2 rounded-lg bg-black/5 p-3 dark:bg-white/10">
      <code className="min-w-0 flex-1 break-all font-mono text-xs leading-5">{command}</code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md border border-black/10 px-2 py-1 text-xs transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
      >
        {copied ? '복사됨' : '복사'}
      </button>
    </div>
  );
}

function UploadStatus({ state }: { state: UploadState }) {
  switch (state.status) {
    case 'idle':
      return null;
    case 'reading':
      return (
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
          파일을 읽는 중이에요…
        </p>
      );
    case 'error':
      return (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      );
    case 'parsed':
      return (
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
          {state.fileName}에서 커밋 {state.commits.length.toLocaleString('ko-KR')}개를 읽었어요.
          {state.skipped > 0 && ` 형식이 맞지 않는 ${state.skipped.toLocaleString('ko-KR')}개는 건너뛰었어요.`}
        </p>
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

  function toggle(email: string) {
    const next = new Set(selectedEmails);
    if (next.has(email)) {
      next.delete(email);
    } else {
      next.add(email);
    }
    onSelectedEmailsChange(next);
  }

  return (
    <div className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-semibold">내 이메일을 골라 주세요</legend>
        <p className="-mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          회사 메일과 개인 메일처럼 여러 개를 썼다면 모두 골라 주세요. 고른 이메일로 작성한 커밋만 분석해요.
        </p>
        <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/15 dark:border-white/15">
          {authors.map(author => (
            <li key={author.email}>
              <label className="flex cursor-pointer items-center gap-3 px-5 py-3">
                <input
                  type="checkbox"
                  checked={selectedEmails.has(author.email)}
                  onChange={() => toggle(author.email)}
                  className="size-4 accent-foreground"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{author.names.join(', ')}</span>
                  <span className="truncate text-xs text-zinc-500">{author.email}</span>
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  커밋 {author.commitCount.toLocaleString('ko-KR')}개
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {selectedEmails.size > 0 ? (
        <ContributionReport
          summary={summary}
          commits={myCommits}
          share={{ mine: myCommits.length, total: commits.length }}
          emptyHint="고른 이메일로 작성한 커밋이 없어요."
        />
      ) : (
        <p className="rounded-xl border border-dashed border-black/15 px-6 py-10 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
          이메일을 고르면 기여 분석 결과가 여기에 나와요.
        </p>
      )}
    </div>
  );
}
