# Issue #7 — 메인 페이지 레이아웃 (분할 뷰 골격) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tailwind 기반 헤더 + 좌측 패널(폭 고정) + 우측 캔버스(가변) 의 분할 뷰 골격을 생성. 각 섹션은 후속 이슈에서 채워질 위치를 명확히 보여주는 placeholder. 헤더에 `+ 새 태스크`/`⚙ 설정` 버튼 (시각만, 액션은 #9/#17 에서 연결).

**Architecture:** 화면을 3개 컴포넌트(Header / Sidebar / Canvas)로 분해. 각각 단일 책임 — Header 는 상단 액션 바, Sidebar 는 NEXT QUEST + SIDE QUESTS + 진행 현황 섹션, Canvas 는 우측 그래프 영역. `app/page.tsx` 는 컴포지션만 담당. 후속 이슈 (#8 DAG / #14 추천 패널 / #15 핀 / #22 카드 / #23 사이드 퀘스트) 는 각자 자기 컴포넌트만 손대면 됨 — boundary 명확.

**Tech Stack:** Next.js App Router · React Server Components · Tailwind CSS

**Issue:** [#7 메인 페이지 레이아웃](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/7)
**Branch model:** `feature/7-main-layout → main` (트렁크 기반)

---

## File Structure

| File | Purpose |
|---|---|
| `app/components/Header.tsx` | 상단 액션 바 — 로고 + 새 태스크/설정 버튼. 버튼은 시각적 placeholder (onClick 없음). |
| `app/components/Sidebar.tsx` | 좌측 패널 — NEXT QUEST / SIDE QUESTS / 진행 현황 3 섹션, 각 후속 이슈 번호 명시한 placeholder 박스. 폭 고정 (w-80). |
| `app/components/Canvas.tsx` | 우측 그래프 캔버스 — 중앙 placeholder 박스 "#8 에서 채워집니다". flex-1 로 가변. |
| `app/page.tsx` | 위 3개 컴포넌트 컴포지션. flex column 으로 헤더 + 분할 행. h-screen. |
| `app/layout.tsx` | body 에 글로벌 톤(antialiased, text-slate-900, bg-slate-50) 추가. |

**Not creating** (각자 자기 후속 이슈에서):
- 클릭 액션 — `+ 새 태스크` 는 #9, `⚙` 는 #17
- 실제 추천/사이드/진행/캔버스 컨텐츠 — #8/#14/#22/#23 각각

---

## Task 0: Feature 브랜치

- [ ] **Step 0.1: main 최신화 + 분기**

```bash
git checkout main && git pull origin main && git checkout -b feature/7-main-layout
```

Expected:
- `main` 동기화 (#6 머지 포함)
- `Switched to a new branch 'feature/7-main-layout'`

---

## Task 1: Header 컴포넌트

**Files:**
- Create: `app/components/Header.tsx`

- [ ] **Step 1.1: `app/components/Header.tsx` 작성**

```tsx
export function Header() {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <h1 className="text-lg font-semibold text-slate-900">flowtodo</h1>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600"
        >
          + 새 태스크
        </button>
        <button
          type="button"
          aria-label="설정"
          className="rounded-md p-2 text-slate-600 transition-colors hover:bg-slate-100"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 1.2: 타입 검사**

```bash
npm run typecheck
```

Expected: 출력 없음 / exit 0.

- [ ] **Step 1.3: Commit**

```bash
git add app/components/Header.tsx && git commit -m "feat(ui): add Header component with placeholder action buttons (#7)"
```

---

## Task 2: Sidebar 컴포넌트

**Files:**
- Create: `app/components/Sidebar.tsx`

- [ ] **Step 2.1: `app/components/Sidebar.tsx` 작성**

```tsx
function PlaceholderBox({ note }: { note: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
      {note}
    </div>
  );
}

function Section({
  label,
  note,
}: {
  label: string;
  note: string;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </h2>
      <PlaceholderBox note={note} />
    </section>
  );
}

export function Sidebar() {
  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
      <Section label="▶ NEXT QUEST" note="추천 카드는 #14 에서 채워집니다" />
      <Section label="⚡ SIDE QUESTS" note="사이드 퀘스트는 #23 에서 채워집니다" />
      <Section label="진행 현황" note="메인/사이드 진행률은 #23 에서 채워집니다" />
    </aside>
  );
}
```

- [ ] **Step 2.2: 타입 검사**

```bash
npm run typecheck
```

Expected: 출력 없음 / exit 0.

- [ ] **Step 2.3: Commit**

```bash
git add app/components/Sidebar.tsx && git commit -m "feat(ui): add Sidebar with NEXT QUEST / SIDE QUESTS / 진행 현황 placeholders (#7)"
```

---

## Task 3: Canvas 컴포넌트

**Files:**
- Create: `app/components/Canvas.tsx`

- [ ] **Step 3.1: `app/components/Canvas.tsx` 작성**

```tsx
export function Canvas() {
  return (
    <main className="relative flex-1 overflow-hidden bg-slate-100">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-8 py-6 text-center text-sm text-slate-400">
          DAG 캔버스는 #8 에서 채워집니다
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3.2: 타입 검사**

```bash
npm run typecheck
```

Expected: 출력 없음 / exit 0.

- [ ] **Step 3.3: Commit**

```bash
git add app/components/Canvas.tsx && git commit -m "feat(ui): add Canvas placeholder for DAG (#7)"
```

---

## Task 4: `app/page.tsx` + `app/layout.tsx` 컴포지션

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 4.1: `app/page.tsx` 를 새로 작성 (기존 placeholder 콘텐츠 교체)**

```tsx
import { Canvas } from './components/Canvas';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';

export default function Home() {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <Canvas />
      </div>
    </div>
  );
}
```

- [ ] **Step 4.2: `app/layout.tsx` 의 body 에 글로벌 톤 클래스 추가**

`app/layout.tsx` 의 `<body>` 부분만 변경:

```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'flowtodo',
  description: 'DAG-based todo with quest-style next-action recommendations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4.3: 검증**

```bash
npm run typecheck && npm run lint && npm run format && npm run format:check
```

Expected: 모두 통과.

- [ ] **Step 4.4: Commit**

```bash
git add app/page.tsx app/layout.tsx && git commit -m "feat(ui): compose Header/Sidebar/Canvas in split-view dashboard (#7)"
```

---

## Task 5: Smoke verification

- [ ] **Step 5.1: production build 확인**

```bash
npm run build
```

Expected (마지막 부분):
```
Route (app)                              Size     First Load JS
┌ ○ /                                    ...
├ ○ /_not-found                          ...
├ ƒ /api/health                          ...
├ ƒ /api/tasks                           ...
└ ƒ /api/tasks/[id]                      ...
```

`/` 는 `○ (Static)` 로 prerender. 컴포넌트가 모두 서버 컴포넌트라 가능.

- [ ] **Step 5.2: dev 서버 실행**

```bash
npm run dev
```

브라우저에서 http://localhost:3000 열기.

- [ ] **Step 5.3: 시각 확인**

체크 항목:
- [ ] 상단 헤더: 좌측 "flowtodo" 로고, 우측 "+ 새 태스크" (주황) + "⚙" 버튼
- [ ] 좌측 패널: 320px 폭 고정, 흰 배경, 우측 경계선. 3개 섹션("▶ NEXT QUEST", "⚡ SIDE QUESTS", "진행 현황") 각각 점선 placeholder 박스에 후속 이슈 번호 명시.
- [ ] 우측 캔버스: 회색 배경(slate-100), 중앙에 "DAG 캔버스는 #8 에서 채워집니다" placeholder.
- [ ] 화면 폭을 줄여도(브라우저 1100px 이상 가정) 레이아웃 깨지지 않음.
- [ ] DevTools Console: 에러 0.
- [ ] 헤더 버튼 hover: 색 변화 작동 (`+ 새 태스크` 더 진한 주황, `⚙` 배경 회색). 클릭은 아무 일도 안 함 (의도).

`Ctrl+C` 로 dev 서버 종료.

- [ ] **Step 5.4: 최종 git 상태**

```bash
git status --short
```

Expected: 빈 출력 (모두 commit).

---

## Task 6: Push + PR + 머지

- [ ] **Step 6.1: plan commit + push**

```bash
git add docs/superpowers/plans/2026-06-05-issue-07-main-layout.md && \
git commit -m "docs: add implementation plan for #7 main layout" && \
git push -u origin feature/7-main-layout
```

- [ ] **Step 6.2: PR 생성**

```bash
gh pr create --repo boostcampwm-snu-2026-1/flowtodo-pkdje \
  --base main --head feature/7-main-layout \
  --title "feat: main page split-view layout (Header + Sidebar + Canvas) (#7)" \
  --body "$(cat <<'EOF'
Closes #7.

## 변경
- **`app/components/Header.tsx`** — 상단 액션 바. 로고 + `+ 새 태스크` (주황 primary) + `⚙ 설정` 버튼. 시각만, 클릭 액션 없음 (#9 / #17 에서 연결 예정).
- **`app/components/Sidebar.tsx`** — 좌측 패널 (w-80 = 320px 고정). 3개 섹션:
  - `▶ NEXT QUEST` — #14 에서 채워짐
  - `⚡ SIDE QUESTS` — #23 에서 채워짐
  - `진행 현황` — #23 에서 채워짐
- **`app/components/Canvas.tsx`** — 우측 그래프 캔버스 (flex-1). 중앙 placeholder "DAG 캔버스는 #8 에서 채워집니다".
- **`app/page.tsx`** — Header + (Sidebar + Canvas) 컴포지션. `h-screen flex flex-col`.
- **`app/layout.tsx`** — body 에 글로벌 톤 (`bg-slate-50 text-slate-900 antialiased`).

## 검증
- [x] `npm run typecheck` 통과
- [x] `npm run lint` 통과
- [x] `npm run format:check` 통과
- [x] `npm run build` 성공 (`/` 는 `○ (Static)` 로 prerender, 서버 컴포넌트만 사용)
- [x] `npm run dev` → http://localhost:3000 에서 헤더 + 좌측 패널 + 우측 캔버스 분할 정상, 후속 이슈 번호 명시된 placeholder 표시, console 에러 0

## 후속
- [#8 React Flow 기반 DAG 렌더](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/8) — `Canvas.tsx` 가 데이터 fetch + React Flow + dagre 로 갱신됨
- [#9 태스크 생성 모달](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/9) — `Header.tsx` 의 `+ 새 태스크` 버튼 클릭 액션 연결
EOF
)"
```

- [ ] **Step 6.3: 머지 + 로컬 정리**

```bash
gh pr merge <PR번호> --repo boostcampwm-snu-2026-1/flowtodo-pkdje --squash
# y (로컬 브랜치 삭제)
git checkout main && git pull origin main
```

---

## Definition of Done

1. 이슈 [#7 AC](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/7) 3개 다 충족:
   - Tailwind 로 2단 분할 레이아웃 (Task 4) ✓
   - 헤더에 `+ 새 태스크`, `⚙ 설정` 버튼 (Task 1, 액션 없음 명시) ✓
   - 좌측 패널 폭 고정 (`w-80`), 우측 캔버스 가변 (`flex-1`) (Task 2, 3, 4) ✓
2. typecheck / lint / format / build 통과.
3. PR 머지 후 main 반영.
4. 후속 이슈 (#8 / #9 / #14 / #22 / #23) 가 손댈 컴포넌트가 명확히 분리되어 있음.

---

## After Merge

- 이슈 #7 자동 close.
- 다음 plan: [#8 React Flow 기반 DAG 렌더](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/8) — `Canvas.tsx` 안에 React Flow + dagre 통합. 데이터는 `/api/tasks` 에서 fetch. 스파이크에서 검증한 설정값([04-quest-game-ui §8](../planning/04-quest-game-ui.md#8-implementation-hints-spike-2-결과-반영)) 적용.
