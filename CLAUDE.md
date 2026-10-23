@AGENTS.md

# shipped

GitHub 커밋 이력을 분석해 "문제 → 해결 → 결과" 형식의 경력기술서 초안을 만들어 주는 서비스.
사용자가 연결한 레포에서 본인 커밋만 추려 근거로 삼고, 문장마다 수락·수정·거절할 수 있게 한다.

## 답변 규칙

- **답변은 항상 한국어(해요체)로 한다.** 짧은 진행 안내, 도구 결과 요약, 작업 완료 보고도 예외 없음.

## 기술 스택

- Next.js 16 (App Router, `src/`), React 19, TypeScript (strict)
- [@bestow-ui/react](https://github.com/Dev-BestOW/BestOW-UI) 디자인 시스템 + CSS Modules, 글꼴 Pretendard
- ESLint
- Anthropic 공식 SDK(`@anthropic-ai/sdk`) + Claude Opus 5.5 — 호출 코드는 `src/server/resume/`
- npm (`package-lock.json` 기준)

## 명령어

```bash
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npx tsc --noEmit # 타입 검사
npm test         # 단위 테스트 (Vitest, src/**/*.test.ts)
npm run test:e2e # E2E (Playwright, e2e/)
```

작업을 마치면 `lint`, `tsc`, `test`, `build`를 통과하는지 확인한다. 화면 흐름을 바꿨으면 `test:e2e`도 돌린다.
순수 로직(lib, 서버 분석 함수)을 바꾸면 옆의 `*.test.ts`도 함께 고친다.

## 폴더 구조

```
src/
├── app/                 # 라우트만 둔다 (page, layout, route handler)
│   └── api/             # Route Handler (LLM 호출, GitHub API 프록시)
├── features/<도메인>/    # 기능 단위 코드: components, hooks, lib, types
│   ├── auth/            #   GitHub 로그인
│   ├── repos/           #   레포 목록, 커밋 수집
│   └── resume/          #   경력기술서 생성, 문장 편집, 내보내기
├── components/ui/       # 여러 기능에서 쓰는 공통 UI
├── lib/                 # 공통 유틸 (클라이언트·서버 모두 사용 가능)
└── server/              # 서버 전용 코드. 파일 첫 줄에 `import 'server-only'`
```

- 라우트 파일(`app/`)은 얇게 유지하고, 로직은 `features/`나 `server/`에 둔다.
- 한 기능에서만 쓰는 코드는 그 기능 폴더 안에 둔다. 두 곳 이상에서 쓰일 때 `components/ui`나 `lib`로 옮긴다.
- 폴더는 필요해질 때 만든다. 빈 폴더를 미리 만들지 않는다.

## 코드 규칙

- `any`를 쓰지 않는다. 외부 데이터(GitHub API, LLM 응답)는 Zod 스키마로 검증한 뒤 사용한다.
- 컴포넌트는 기본이 Server Component다. 상태나 브라우저 API가 필요할 때만 `'use client'`를 붙인다.
- UI 문구는 한국어로 쓴다.

## UI 규칙

- 화면은 `@bestow-ui/react` 컴포넌트로 만든다. 배치는 `Stack`·`Grid`·`Container`, 글자는 `Typography`를 쓴다.
  props는 `node_modules/@bestow-ui/react/dist/index.d.ts`나 [llms-full.txt](https://dev-bestow.github.io/BestOW-UI/llms-full.txt)에서 확인한다.
- 컴포넌트로 안 되는 부분만 같은 폴더의 `*.module.css`에 쓴다. 색·간격·글자 크기는 `var(--bestow-*)` 토큰만 쓰고 값을 직접 적지 않는다(다크 모드·브랜드 테마를 따라가도록).
- 서버 컴포넌트에서 Next 링크를 붙일 때는 `<Link asChild><NextLink …/></Link>`를 쓴다(`as={NextLink}`는 클라이언트 컴포넌트에서만).
- `Button`은 `asChild`를 받지 않는다. 버튼 모양 링크는 `components/ui/ButtonLink`를 쓴다.
- 페이지 틀은 `components/ui/Page`(`Page`·`PageHeader`·`EmptyState`), 구분선 목록은 `DividedList`를 쓴다.
- BestOW-UI의 버그나 빈칸(직접 짜야 했던 것)을 찾으면 로컬 레포 `../BestOW-UI/docs/PILOT-FINDINGS.md`의
  "파일럿 2 — shipped" 섹션에 같은 표 형식으로 적는다. 그 레포에서도 커밋은 하지 않는다.
- 비동기 작업은 로딩·실패·빈 상태를 모두 화면에 표시한다.

## 보안과 개인정보

- API 키와 토큰(Anthropic, GitHub)은 서버에서만 쓴다. `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
- 환경 변수는 `.env.local`에 두고, 필요한 키 이름은 `.env.example`에 값 없이 기록한다.
- LLM에는 분석에 필요한 최소한만 보낸다. 기본은 커밋 메시지와 통계이고, 코드 내용은 사용자가 고른 파일만 보낸다.
- 사용자의 레포 데이터를 서버에 영구 저장하지 않는다.

## 생성 결과 원칙

- 경력기술서의 수치와 사실은 커밋·코드 근거에서만 나온다. 근거가 없는 수치는 `[N]` 같은 빈칸으로 남긴다.
- 문장마다 근거 커밋을 연결해, 사용자가 출처를 확인할 수 있게 한다.
- 다른 사람이 작성한 커밋은 본인 성과에 넣지 않는다.

## Git

- **git commit / push 는 하지 않는다.** 사용자가 직접 한다. 작업이 끝나면 바뀐 파일과 확인 결과만 보고한다.
- **작업을 마치면 커밋 메시지를 추천한다** — [gitmoji](https://gitmoji.dev/) + 한국어 한 줄 (기존 기록과 같은 형식,
  예: `✨ LocaleProvider(다국어 문구)와 한글 줄바꿈 기본값 추가`). 여러 영역에 걸치면 짧은 본문(글머리표)을 붙인다.
  자주 쓰는 것: ✨ 기능 · 🐛 버그 · ♻️ 리팩터링 · 📝 문서 · ✅ 테스트 · 💚 CI 수정 · 👷 CI 설정 · ⬆️ 의존성 · 🏷️ 타입 ·
  🗑️ deprecated · 💥 breaking · 🔧 설정 · 📸 스냅숏 · ♿️ 접근성 · 🌐 다국어 · 💄 UI 스타일 · ⚡️ 성능.
