# flowtodo

선후관계가 있는 일을 DAG(방향 비순환 그래프)로 정리하고, 다음에 할 일을 자동으로 골라주는 개인용 todo 웹앱.

> Boostcamp WM SNU 2026 · 3주 개인 프로젝트 (박동제 / [@pkdje](https://github.com/pkdje))

**현재 상태**: Week 3 진행 중 — GitHub OAuth 인증 + Vercel 배포 (#19) 완료. polish/시각 리뉴얼 진행 예정.

---

## 핵심 기능

- **Task DAG** — 태스크 간 선후관계를 그래프로 명시. 한 태스크가 여러 선행 작업을 가질 수 있음.
- **시각화** — React Flow + dagre 자동 레이아웃 ([lib/dag.ts](lib/dag.ts)). 노드 상태별 색상, 의존성 엣지 자동 그림.
- **편집 인터랙션** —
  - **클릭** 으로 우측 편집 드로어 열기 (모든 필드 편집 + 삭제)
  - **더블클릭** 으로 status 순환 (`todo → in_progress → done → todo`)
  - **핸들 드래그** 로 의존성 엣지 생성. 사이클이 생기는 시도는 드래그 중 빨강 점선으로 즉시 차단.
  - **엣지 클릭** 으로 삭제 확인 후 의존성 제거.
- **다음 작업 추천** — 좌측 `▶ NEXT QUEST` 패널에 Top 3 카드 표시. 점수 = `0.6 · (6-priority)/5 + 0.4 · impact/maxImpact`. 카드 클릭 시 캔버스가 해당 노드로 카메라 이동. 각 카드는 "▷ X, Y 해금" 다운스트림 미리보기 포함.
- **상태 관리** — Zustand store ([lib/store.ts](lib/store.ts)) 가 tasks · 모달 · 드로어 · 추천 모두 한 곳에서 관리.
- **사용자 인증** — NextAuth.js v4 + GitHub OAuth. JWT 세션. 각 task 가 `userId` 로 격리되어 본인 것만 보임 (#19).

자세한 기획: [Wiki — 프로젝트 기획서](../../wiki/01-project-plan)
퀘스트 게임 UI 디테일: [Wiki — Quest Game UI](../../wiki/04-quest-game-ui)

---

## 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 14.2 (App Router) | Server / Client 컴포넌트 경계는 페이지 root 가 `<ReactFlowProvider>` 로 client |
| 언어 | TypeScript (strict) | `npx tsc --noEmit` 매 PR 통과 |
| DB | MongoDB Atlas M0 + 공식 `mongodb` 드라이버 | 싱글톤 + dev 모드 globalThis 캐시 |
| 시각화 | React Flow 11 + dagre 0.8 | spike 검증 설정: `nodesep:12, ranksep:28, ranker:'tight-tree'` |
| 상태관리 | Zustand 5.x | tasks · createModalOpen · selectedTaskId · selectTask/updateTask/deleteTask 등 |
| 스타일 | Tailwind 3.4 + Prettier plugin | |
| 인증 | NextAuth.js v4 (Auth.js) + GitHub OAuth | JWT session, `lib/auth.ts` |
| 테스트 | Vitest 4.1 (3 파일, 43 케이스) | `lib/tasks.test.ts`, `lib/dag.test.ts`, `lib/recommender.test.ts` |
| 배포 | Vercel + Atlas | 환경변수 5개 (아래 §배포 참조) |

선택 이유: [Wiki — 프로젝트 기획서 §3](../../wiki/01-project-plan#3-기술-스택-및-선택-이유)

---

## 셋업 (로컬)

```bash
# 1. clone + deps
git clone https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje.git
cd flowtodo-pkdje
npm install

# 2. 환경변수 — .env.local 복사 후 채우기
cp .env.example .env.local
```

### `.env.local` 변수

| 변수 | 설명 | 값 얻는 법 |
|---|---|---|
| `MONGODB_URI` | Atlas connection string | Atlas 대시보드 → Connect → driver |
| `NEXTAUTH_SECRET` | JWT 서명 비밀키 | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | 사이트 URL | 로컬 = `http://localhost:3000` |
| `GITHUB_ID` | OAuth Client ID | 아래 §GitHub OAuth App 등록 |
| `GITHUB_SECRET` | OAuth Client Secret | 동일 |

### GitHub OAuth App 등록 (로컬용)

1. https://github.com/settings/developers → **New OAuth App**
2. Application name: `flowtodo (local)`
3. Homepage URL: `http://localhost:3000`
4. Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
5. 생성 후 Client ID + Generate Client Secret → `.env.local` 에 넣기

```bash
# 3. dev 서버
npm run dev   # http://localhost:3000 → GitHub OAuth 로그인 후 사용
```

### 검증

```bash
npx tsc --noEmit       # 타입 체크
npx next lint          # ESLint
npx vitest run         # 단위 테스트 (43 케이스)
npx next build         # 프로덕션 빌드
```

### 주요 스크립트

| 명령 | 용도 |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` | 프로덕션 빌드 |
| `npm test` | Vitest 1회 실행 |

---

## Vercel 배포

### 1. GitHub OAuth App (prod 용 — 별도 등록 권장)

1. https://github.com/settings/developers → **New OAuth App**
2. Homepage URL: `https://<your-vercel-domain>`
3. Authorization callback URL: `https://<your-vercel-domain>/api/auth/callback/github`

### 2. Vercel 프로젝트 생성

1. https://vercel.com → New Project → 이 저장소 import
2. 빌드 설정은 기본값 (Next.js 자동 감지)

### 3. 환경변수 (Vercel 대시보드 → Settings → Environment Variables)

| 변수 | 값 |
|---|---|
| `MONGODB_URI` | Atlas connection string (`?retryWrites=true&w=majority` 포함) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` 결과 |
| `NEXTAUTH_URL` | `https://<your-vercel-domain>` |
| `GITHUB_ID` | prod OAuth App 의 Client ID |
| `GITHUB_SECRET` | prod OAuth App 의 Client Secret |

### 4. Atlas IP allowlist

Atlas → Network Access → `0.0.0.0/0` 허용 (Vercel serverless 가 정적 IP 가 아님).

### 5. 배포

`main` 에 push 하면 자동 빌드. PR 마다 preview URL 도 자동.

---

## 개발 관리

### 브랜치 모델 (트렁크 기반)

- `main` — 트렁크. 모든 PR 의 머지 대상이자 외부 가시 결과.
- `feature/<n>-<slug>` — 기능별 작업 브랜치. main 에서 분기 → squash merge.
- `dev` 브랜치는 초기 베이스라인 sync 시점 이후 폐기됨 (트렁크 기반으로 변경).

### Task / PR 흐름

1. GitHub Issue 에 task 등록 (Acceptance Criteria 포함, 1~2일 분량).
2. `brainstorming` skill 로 spec 합의 → `writing-plans` 로 TDD 단위 plan 작성 → 브랜치 분기.
3. `executing-plans` 로 실행 (사용자는 git, AI 는 npm/test/build).
4. PR `feature → main`. squash merge 시 이슈 자동 close.

> 솔로/3주 스코프에 dev 경유 2단계 PR 은 오버킬이라 트렁크 기반 채택.

### 문서

- 기획서 / 워크플로우 / 회고 — [GitHub Wiki](../../wiki)
- Spec / Plan — [`docs/superpowers/specs/`](docs/superpowers/specs), [`docs/superpowers/plans/`](docs/superpowers/plans)
- 기획 문서 로컬 사본 — [`docs/planning/`](docs/planning)

---

## 진행 상황

| 주차 | 상태 | 산출물 |
|---|---|---|
| Week 1 | ✅ 완료 | [기획서](../../wiki/01-project-plan), [워크플로우](../../wiki/02-agent-workflow), [Task 백로그](docs/planning/03-task-backlog.md), 스파이크 #2 |
| Week 2 | ✅ 완료 | CRUD API · DAG 렌더 · 추천 엔진 · NEXT QUEST 패널 · 편집 드로어 · 엣지 드래그 ([회고](../../wiki/Weekly-Retrospective#week-2)) |
| Week 3 | 🟡 진행 중 | **#19 인증 + 배포 완료**. 남음: polish (#18), 퀘스트 카드 노드 (#22), 사이드 패널 (#23), 핀/snooze (#15), 가중치 슬라이더 (#17) |

배포 URL: _Vercel 대시보드에서 도메인 추가 후 여기에 표시_

---

## 라이선스

본 저장소는 학습 목적의 개인 프로젝트이며 별도 라이선스 명시 없음.
