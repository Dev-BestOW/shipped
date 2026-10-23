/**
 * 변경 줄 수 집계에서 빼는 lockfile. 패키지 매니저가 자동으로 만드는 파일이라
 * 의존성 하나만 바꿔도 수천 줄이 바뀌어 본인 작업량을 부풀린다.
 */
const LOCKFILE_NAMES = new Set([
  // JavaScript
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lock',
  'bun.lockb',
  'deno.lock',
  // Python
  'poetry.lock',
  'Pipfile.lock',
  'uv.lock',
  'pdm.lock',
  // 기타 언어
  'Cargo.lock',
  'Gemfile.lock',
  'composer.lock',
  'go.sum',
  'mix.lock',
  'pubspec.lock',
  'Podfile.lock',
  'Package.resolved',
  'gradle.lockfile',
  'packages.lock.json',
  'flake.lock',
]);

/** 경로가 lockfile이면 true. 폴더와 상관없이 파일 이름으로 판단한다. */
export function isLockfile(path: string): boolean {
  return LOCKFILE_NAMES.has(path.slice(path.lastIndexOf('/') + 1));
}
