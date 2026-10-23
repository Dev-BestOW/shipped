# shipped

> 내가 실제로 만든 것을, 근거와 함께.

GitHub 커밋 이력을 분석해 **"문제 → 해결 → 결과"** 형식의 경력기술서 초안을 만들어 주는 서비스입니다.

## 왜 만들었나

이직을 준비하며 경력기술서를 쓰다 보면, 몇 달 전 작업은 기억이 흐릿하고 성과는 형용사로만 남습니다.
정작 내가 한 일의 근거는 커밋 이력에 다 남아 있는데도요.

shipped는 레포에서 **본인 커밋만** 추려 내고, 그 근거로 경력기술서 문장을 씁니다.
근거가 없는 수치는 지어내지 않고 빈칸으로 남겨, 사용자가 직접 채우게 합니다.

## 주요 기능 (개발 예정)

- **GitHub 연결**: OAuth로 로그인하고 분석할 레포를 고릅니다.
- **기여 분석**: 레포별로 본인 커밋과 기간, 비중, 변경 줄 수(lockfile 제외)를 정리합니다.
- **git log 업로드**: 회사 GitLab처럼 GitHub에 없는 레포는 `git log` 파일로 분석합니다. 파일은 브라우저에서만 읽습니다.
- **실시간 작성**: 분석 단계("커밋 수집 → 기여 분석 → 문장 작성")를 보여 주며 경력기술서를 스트리밍으로 작성합니다.
- **문장별 검토**: 문장마다 근거 커밋을 확인하고 수락·수정·거절합니다.
- **내보내기**: 완성한 경력기술서를 PDF로 저장합니다.

## 개인정보 원칙

- LLM에는 커밋 메시지와 통계 위주로 보내고, 코드 내용은 사용자가 고른 파일만 보냅니다.
- 레포 데이터를 서버에 영구 저장하지 않습니다.

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| 프레임워크 | Next.js 16 (App Router), React 19, TypeScript |
| UI | [@bestow-ui/react](https://github.com/Dev-BestOW/BestOW-UI) (직접 만든 디자인 시스템), CSS Modules, Pretendard |
| LLM | Vercel AI SDK, Claude |
| 인증·데이터 | GitHub OAuth, GitHub REST API |
| 테스트 | Vitest, Playwright |

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local   # 값을 채운다 (아래 GitHub App 설정 참고)
npm run dev
```

### GitHub App 설정

[GitHub App 만들기](https://github.com/settings/apps/new)에서 아래처럼 설정합니다.

| 항목 | 값 |
| --- | --- |
| GitHub App name | GitHub 전체에서 겹치지 않는 이름 (예: `shipped-<아이디>`) |
| Homepage URL | 레포 주소 등 아무 URL (로그인 동작에는 쓰이지 않음) |
| Callback URL | `http://localhost:3000/api/auth/callback` |
| Expire user authorization tokens | 체크 (refresh token 사용) |
| Request user authorization (OAuth) during installation | 체크 해제 (켜면 설치 직후 state 없이 콜백이 와서 실패) |
| Webhook | Active 체크 해제 |
| Repository permissions | Contents: Read-only, Metadata: Read-only |
| Where can this GitHub App be installed? | Any account |

만든 뒤 Client ID, Client secret(새로 생성), 앱 주소의 slug를 `.env.local`에 넣습니다.

http://localhost:3000 에서 확인할 수 있습니다.

## 진행 상황

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| 1 | 프로젝트 기본 세팅 | 완료 |
| 2 | 프로젝트 규칙 정리 (`CLAUDE.md`, README) | 완료 |
| 3 | GitHub 로그인과 레포 목록 | 완료 |
| 4 | 커밋 수집, 본인 기여 분석 | 완료 |
| 5 | 경력기술서 스트리밍 생성 | 예정 |
| 6 | 분석 단계 표시 (tool calling) | 예정 |
| 7 | 구조화 출력, 문장별 수락·거절 | 예정 |
| 8 | 테스트, PDF 내보내기, 배포 | 예정 |
