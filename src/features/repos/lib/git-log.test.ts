import { describe, expect, it } from 'vitest';
import { decodeGitLogFile, listGitLogAuthors, parseGitLog } from './git-log';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

/** GIT_LOG_COMMAND가 만드는 형식으로 커밋 하나를 쓴다. */
function record(sha: string, name: string, email: string, date: string, message: string, numstat: string[]) {
  return `\x1e${sha}\x1f${name}\x1f${email}\x1f${date}\x1f${message}\x1d\n\n${numstat.join('\n')}\n`;
}

describe('parseGitLog', () => {
  it('커밋 메시지·작성자·파일별 줄 수를 읽는다', () => {
    const text = record(SHA_A, '석지원', 'Me@Example.com', '2026-01-02T03:04:05+09:00', 'feat: 로그인\n\n본문', [
      '10\t2\tsrc/a.ts',
      '3\t0\tsrc/b.ts',
    ]);
    const { commits, skipped } = parseGitLog(text);

    expect(skipped).toBe(0);
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({
      sha: SHA_A,
      headline: 'feat: 로그인',
      message: 'feat: 로그인\n\n본문',
      authorName: '석지원',
      authorEmail: 'me@example.com',
      url: null,
      lineStats: {
        additions: 13,
        deletions: 2,
        changedFiles: 2,
        files: [
          { path: 'src/a.ts', additions: 10, deletions: 2 },
          { path: 'src/b.ts', additions: 3, deletions: 0 },
        ],
      },
    });
  });

  it('lockfile은 이름이 바뀐 경우까지 줄 수에서 뺀다', () => {
    const text = record(SHA_A, 'me', 'me@x.com', '2026-01-02T03:04:05+09:00', 'chore', [
      '5000\t10\tpackage-lock.json',
      '3\t3\tapps/{old => web}/pnpm-lock.yaml',
      '1\t1\tyarn.lock => docs/notes.md',
      '-\t-\timg.png',
    ]);
    const { lineStats } = parseGitLog(text).commits[0];

    // 이름이 lockfile에서 일반 파일로 바뀐 경우는 센다. 바이너리는 0줄.
    expect(lineStats).toMatchObject({ additions: 1, deletions: 1, changedFiles: 2 });
    expect(lineStats?.files.map(file => file.path)).toEqual(['docs/notes.md', 'img.png']);
  });

  it('Windows 줄바꿈(CRLF) 파일도 읽는다', () => {
    const text = record(SHA_A, 'me', 'me@x.com', '2026-01-02T03:04:05+09:00', 'fix', ['4\t1\tsrc/a.ts']).replace(
      /\n/g,
      '\r\n',
    );
    const [commit] = parseGitLog(text).commits;

    expect(commit.headline).toBe('fix');
    expect(commit.lineStats).toMatchObject({ additions: 4, deletions: 1 });
  });

  it('형식이 맞지 않는 기록은 건너뛰고 개수를 센다', () => {
    const text = `${record(SHA_A, 'me', 'me@x.com', '2026-01-02T03:04:05+09:00', 'ok', [])}\x1enot-a-sha\x1fme\x1fme@x.com\x1fdate\x1fmsg\x1d\n`;
    const { commits, skipped } = parseGitLog(text);

    expect(commits).toHaveLength(1);
    expect(skipped).toBe(1);
  });
});

describe('decodeGitLogFile', () => {
  it('UTF-16 BOM이 있으면 UTF-16으로 읽는다 (PowerShell 5의 > 저장)', () => {
    const text = record(SHA_A, '석지원', 'me@x.com', '2026-01-02T03:04:05+09:00', '한글 메시지', ['1\t0\ta.ts']);
    const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);

    expect(parseGitLog(decodeGitLogFile(buffer)).commits[0].headline).toBe('한글 메시지');
  });

  it('BOM이 없으면 UTF-8로 읽는다', () => {
    const bytes = new TextEncoder().encode('한글');
    expect(decodeGitLogFile(bytes.buffer)).toBe('한글');
  });
});

describe('listGitLogAuthors', () => {
  it('이메일별로 묶고 커밋이 많은 순으로 정렬한다', () => {
    const text = [
      record(SHA_A, '석지원', 'me@x.com', '2026-01-02T03:04:05+09:00', 'a', []),
      record(SHA_B, 'jiwon', 'ME@x.com', '2026-01-03T03:04:05+09:00', 'b', []),
      record('c'.repeat(40), '동료', 'other@x.com', '2026-01-04T03:04:05+09:00', 'c', []),
    ].join('');
    const authors = listGitLogAuthors(parseGitLog(text).commits);

    expect(authors).toEqual([
      { email: 'me@x.com', names: ['석지원', 'jiwon'], commitCount: 2 },
      { email: 'other@x.com', names: ['동료'], commitCount: 1 },
    ]);
  });
});
