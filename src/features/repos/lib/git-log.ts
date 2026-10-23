import { z } from 'zod';
import type { ContributionCommit } from './contribution';

/**
 * 사용자가 레포 폴더에서 실행할 명령. 커밋 메시지에 줄바꿈이나 탭이 있어도 나눌 수 있도록 제어 문자로 구분한다.
 * - \x1e: 커밋 시작, \x1f: 필드 구분, \x1d: 메시지 끝 (뒤에 --numstat 줄이 이어진다)
 */
export const GIT_LOG_COMMAND =
  "git log --no-merges --numstat --format='%x1e%H%x1f%an%x1f%ae%x1f%aI%x1f%B%x1d' > shipped-log.txt";

/** 업로드할 수 있는 최대 파일 크기 */
export const MAX_GIT_LOG_BYTES = 30 * 1024 * 1024;

export type LocalCommit = ContributionCommit & {
  authorName: string;
  /** 비교하기 쉽도록 소문자로 맞춘다. */
  authorEmail: string;
};

export type GitLogAuthor = {
  email: string;
  /** 같은 이메일로 쓴 이름들 (자주 쓴 순) */
  names: string[];
  commitCount: number;
};

const headerSchema = z.tuple([
  z.string().regex(/^[0-9a-f]{40}([0-9a-f]{24})?$/),
  z.string(),
  z.string(),
  z.iso.datetime({ offset: true }),
  z.string(),
]);

export type ParsedGitLog = {
  commits: LocalCommit[];
  /** 형식이 맞지 않아 건너뛴 기록 수 */
  skipped: number;
};

/** GIT_LOG_COMMAND로 만든 파일 내용을 커밋 목록으로 바꾼다. */
export function parseGitLog(text: string): ParsedGitLog {
  const commits: LocalCommit[] = [];
  let skipped = 0;

  for (const record of text.split('\x1e').slice(1)) {
    const endOfMessage = record.indexOf('\x1d');
    if (endOfMessage === -1) {
      skipped++;
      continue;
    }

    const fields = record.slice(0, endOfMessage).split('\x1f');
    // 메시지 안에 구분 문자가 들어 있어도 잃지 않도록 다섯 번째 이후는 다시 합친다.
    const header = headerSchema.safeParse([...fields.slice(0, 4), fields.slice(4).join('\x1f')]);
    if (!header.success) {
      skipped++;
      continue;
    }
    const [sha, authorName, authorEmail, authoredAt, rawMessage] = header.data;

    let additions = 0;
    let deletions = 0;
    let changedFiles = 0;
    for (const line of record.slice(endOfMessage + 1).split('\n')) {
      const match = /^(\d+|-)\t(\d+|-)\t/.exec(line);
      if (!match) continue;
      changedFiles++;
      // 바이너리 파일은 줄 수가 '-'로 나온다.
      additions += match[1] === '-' ? 0 : Number(match[1]);
      deletions += match[2] === '-' ? 0 : Number(match[2]);
    }

    const message = rawMessage.trim();
    commits.push({
      sha,
      headline: message.split('\n', 1)[0] ?? '',
      message,
      authoredAt,
      additions,
      deletions,
      changedFiles,
      url: null,
      authorName,
      authorEmail: authorEmail.trim().toLowerCase(),
    });
  }

  return { commits, skipped };
}

/** 커밋 작성자를 이메일 기준으로 묶는다. 커밋이 많은 순. */
export function listGitLogAuthors(commits: readonly LocalCommit[]): GitLogAuthor[] {
  const byEmail = new Map<string, { names: Map<string, number>; commitCount: number }>();
  for (const commit of commits) {
    const entry = byEmail.get(commit.authorEmail) ?? { names: new Map(), commitCount: 0 };
    entry.commitCount++;
    entry.names.set(commit.authorName, (entry.names.get(commit.authorName) ?? 0) + 1);
    byEmail.set(commit.authorEmail, entry);
  }

  return [...byEmail]
    .map(([email, { names, commitCount }]) => ({
      email,
      names: [...names].sort((a, b) => b[1] - a[1]).map(([name]) => name),
      commitCount,
    }))
    .sort((a, b) => b.commitCount - a.commitCount);
}
