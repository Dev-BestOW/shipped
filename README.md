# shipped

> 내가 실제로 만든 것을, 근거와 함께.

**서비스 주소:** https://shipped-puce.vercel.app

GitHub 커밋 이력을 분석해 **"문제 → 해결 → 결과"** 형식의 경력기술서 초안을 만들어 주는 서비스입니다.

## 왜 만들었나

이직을 준비하며 경력기술서를 쓰다 보면, 몇 달 전 작업은 기억이 흐릿하고 성과는 형용사로만 남습니다.
정작 내가 한 일의 근거는 커밋 이력에 다 남아 있는데도요.

shipped는 레포에서 **본인 커밋만** 추려 내고, 그 근거로 경력기술서 문장을 씁니다.
근거가 없는 수치는 지어내지 않고 빈칸으로 남겨, 사용자가 직접 채우게 합니다.

## 주요 기능

- **GitHub 연결**: GitHub App으로 로그인하고, 읽기 전용으로 분석할 레포를 고릅니다.
- **기여 분석**: 레포별로 본인 커밋과 기간, 비중, 변경 줄 수(lockfile 제외)를 정리합니다.
- **git log 업로드**: 회사 GitLab처럼 GitHub에 없는 레포는 `git log` 파일로 분석합니다. 파일은 브라우저에서만 읽습니다.
- **실시간 작성**: 분석 단계("커밋 수집 → 기여 분석 → 문장 작성")를 보여 주며 경력기술서를 스트리밍으로 작성합니다.
- **문장별 검토**: 문장마다 근거 커밋을 확인하고 수락·수정·거절합니다.
- **내보내기**: 완성한 경력기술서를 PDF로 저장합니다.

## 개인정보 원칙

- LLM에는 코드 내용을 보내지 않습니다. 커밋 메시지, 변경 파일 경로, 줄 수 통계만 보냅니다.
- 레포 데이터를 서버에 영구 저장하지 않습니다.

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| 프레임워크 | Next.js 16 (App Router), React 19, TypeScript |
| UI | [@bestow-ui/react](https://github.com/Dev-BestOW/BestOW-UI) (직접 만든 디자인 시스템), CSS Modules, Pretendard |
| LLM | Claude Opus 5.5 (Anthropic SDK) |
| 인증·데이터 | GitHub App (OAuth 사용자 인증), GitHub REST·GraphQL API |
| 테스트 | Vitest, Playwright |

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local   # 값을 채운다 (아래 GitHub App 설정 참고)
npm run dev
```

http://localhost:3000 에서 확인할 수 있습니다.

### GitHub App 설정

[GitHub App 만들기](https://github.com/settings/apps/new)에서 아래처럼 설정합니다.

| 항목 | 값 |
| --- | --- |
| GitHub App name | GitHub 전체에서 겹치지 않는 이름 (예: `shipped-<아이디>`) |
| Homepage URL | 레포 주소 등 아무 URL (로그인 동작에는 쓰이지 않음) |
| Callback URL | `http://localhost:3000/api/auth/callback` (배포하면 배포 주소용도 추가, [배포](#배포-vercel) 참고) |
| Expire user authorization tokens | 체크 (refresh token 사용) |
| Request user authorization (OAuth) during installation | 체크 해제 (켜면 설치 직후 state 없이 콜백이 와서 실패) |
| Webhook | Active 체크 해제 |
| Repository permissions | Contents: Read-only, Metadata: Read-only |
| Where can this GitHub App be installed? | Any account |

만든 뒤 Client ID, Client secret(새로 생성), 앱 주소의 slug를 `.env.local`에 넣습니다.

`ANTHROPIC_API_KEY`가 없으면 개발 환경에서는 Claude 대신 **개발용 가짜 응답**으로 초안을 만들어요(화면에 배지로 표시). 키가 있어도 `RESUME_MOCK=1`이면 가짜 응답을 써요.

### 테스트

```bash
npm test          # 단위 테스트 (Vitest)
npm run test:e2e  # E2E (Playwright, 설치된 Chrome 사용. dev 서버가 떠 있으면 그대로 씀)
```

E2E는 가짜 응답 모드로 돌고, 로그인이 필요한 흐름은 `.env.local`의 `SESSION_SECRET`으로 테스트용 세션 쿠키를 만들어 확인해요.
push·PR마다 GitHub Actions(`.github/workflows/ci.yml`)가 lint, 타입 검사, 단위 테스트, 빌드, E2E를 돌려요.

## 배포 (Vercel)

1. Vercel에서 이 레포를 가져와 프로젝트를 만들어요. 설정은 기본값(Next.js) 그대로 두면 돼요.
2. **Environment Variables** (Production)에 아래 값을 넣어요.

   | 이름 | 값 |
   | --- | --- |
   | `APP_URL` | 배포 주소 (예: `https://shipped.vercel.app`) |
   | `GITHUB_APP_CLIENT_ID` | GitHub App의 Client ID |
   | `GITHUB_APP_CLIENT_SECRET` | GitHub App의 Client secret |
   | `GITHUB_APP_SLUG` | GitHub App slug |
   | `SESSION_SECRET` | **로컬과 다른 새 값** (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`) |
   | `ANTHROPIC_API_KEY` | Claude API 키 |

   `RESUME_MOCK`은 넣지 않아요. 프로덕션에서 API 키가 없으면 가짜 응답 대신 오류를 보여 줘요.
3. GitHub App 설정에서 **Callback URL을 하나 더 추가**해요: `https://<배포 주소>/api/auth/callback` (로컬 주소는 그대로 둬도 돼요). Homepage URL도 배포 주소로 바꿔도 좋아요.
4. 배포한 뒤 확인할 것
   - 로그인 → 레포 목록 → 기여 분석까지 열리는지
   - 초안 만들기에서 "개발용 가짜 응답" 배지 없이 분석 단계와 초안이 나오는지, 토큰 수가 표시되는지
   - 로그아웃 후 다시 로그인되는지

경력기술서 생성은 1분 넘게 걸릴 수 있어서 `/api/resume`의 최대 실행 시간을 300초로 두었어요(`maxDuration`). 실제 상한은 Vercel 플랜에 따라 달라요.

## 진행 상황

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| 1 | 프로젝트 기본 세팅 | 완료 |
| 2 | 프로젝트 규칙 정리 (`CLAUDE.md`, README) | 완료 |
| 3 | GitHub 로그인과 레포 목록 | 완료 |
| 4 | 커밋 수집, 본인 기여 분석 | 완료 |
| 5 | 경력기술서 스트리밍 생성 | 완료 (실제 Claude 호출은 API 키 등록 후 확인) |
| 6 | 분석 단계 표시 (tool calling) | 완료 |
| 7 | 구조화 출력, 문장별 수락·거절 | 완료 |
| 8 | 테스트, PDF 내보내기, 배포 | 완료 |
| 9 | 빈칸 채우기 대화 | 예정 |
| 10 | 문장 단위 다시 쓰기 | 예정 |
| 11 | 모의 면접 | 예정 |

### 다음 계획

- **9. 빈칸 채우기 대화**: 근거가 없어 `[N]`으로 남은 수치를 AI가 질문해서 채워요("수정 전에 문의가 한 달에 몇 건이었나요?").
  대화 중 `fill_placeholder` 도구로 해당 문장을 바로 고치고, 채운 값은 커밋 근거와 구분해 "사용자 입력"으로 표시해요.
- **10. 문장 단위 다시 쓰기**: 문장마다 "더 짧게", "기술 결정 이유 강조" 같은 지시를 받아 그 문장만 다시 쓰고, 바뀐 부분을 비교해 수락·거절해요.
- **11. 모의 면접**: 완성한 경력기술서로 예상 질문을 만들고, 사용자 답변에 피드백을 줘요.

대화 내용도 레포 데이터처럼 서버에 저장하지 않아요. 대화 상태는 브라우저에 두고, 요청할 때 필요한 맥락만 보내요.
