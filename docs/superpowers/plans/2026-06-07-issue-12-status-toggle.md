# Issue #12 — 상태 전환 (더블클릭 순환) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캔버스 노드를 더블클릭하면 `todo → in_progress → done → todo` 사이클로 status 가 순환하고 노드 색이 즉시 갱신된다. 단일 클릭은 #10 의 드로어 토글 동작 그대로 유지하되, 더블클릭과 충돌하지 않도록 180ms 지연 발화로 바꾼다.

**Architecture:** `Canvas.tsx` 한 파일만 수정. `clickTimer` ref 로 single click 을 180ms 지연; double click 콜백에서 timer clear. Double click 콜백은 노드 id 단위 inflight `Set` 으로 race 가드 후 `useAppStore.getState().updateTask(id, { status: next })` 호출. 새 store 액션이나 라이브러리 추가 없음.

**Tech Stack:** React Flow 11 `onNodeClick` / `onNodeDoubleClick` · 기존 Zustand store

**Issue:** [#12 상태 전환 (더블클릭 순환)](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/12)
**Spec:** [docs/superpowers/specs/2026-06-07-issue-12-status-toggle-design.md](../specs/2026-06-07-issue-12-status-toggle-design.md)
**Branch model:** `feature/12-status-toggle → main` (트렁크 기반)

---

## File Structure

| File | Purpose |
|---|---|
| `app/components/Canvas.tsx` | `onNodeClick` 을 180ms 지연 발화로 교체, `onNodeDoubleClick` 추가, `nextStatus` inline 헬퍼 추가. |

**Not changing**: store, TaskNode, TaskDrawer, page — 전부 그대로.

**Not in this plan** (의도된 누락):
- 토스트/UI 에러 알림 → #18 polish
- 키보드 단축키 → YAGNI
- 다중 선택 → YAGNI
- done 노드의 후속 task ready 강조 → #13 + #14 에서

---

## Task 0: Feature 브랜치

- [ ] **Step 0.1: main 최신화 + 분기**

```bash
git checkout main && git pull origin main && git checkout -b feature/12-status-toggle
```

Expected:
- `main` 동기화 (#10 머지 + #12 spec 포함)
- `Switched to a new branch 'feature/12-status-toggle'`

---

## Task 1: Canvas — 단일/더블클릭 핸들러 교체

**Files:**
- Modify: `app/components/Canvas.tsx`

- [ ] **Step 1.1: import 추가**

[app/components/Canvas.tsx](app/components/Canvas.tsx) 파일 상단의 import 부분을 다음으로 교체:

```tsx
'use client';

import 'reactflow/dist/style.css';
import { useEffect, useMemo, useRef } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import { TaskNode } from './TaskNode';
import { applyLayout, buildGraph } from '@/lib/dag';
import { useAppStore } from '@/lib/store';
import type { Status, Task } from '@/lib/tasks';
```

(추가된 것: `useRef` 그리고 `Status, Task` 타입 import)

- [ ] **Step 1.2: nextStatus 헬퍼를 파일 하단에 추가**

[app/components/Canvas.tsx](app/components/Canvas.tsx) 의 `function CenterMessage(...) { ... }` 함수 정의 **다음 줄** 에 추가:

```tsx
function nextStatus(s: Status): Status {
  return s === 'todo' ? 'in_progress' : s === 'in_progress' ? 'done' : 'todo';
}
```

- [ ] **Step 1.3: Canvas 함수 본문에 ref 와 핸들러 추가**

`export function Canvas() {` 바로 다음 줄들 (`const tasks = useAppStore...` 등 기존 selector 들) 아래에 다음 블록을 추가 (`useEffect(() => { fetchTasks(); }, [fetchTasks]);` 위에):

```tsx
  const clickTimer = useRef<number | null>(null);
  const togglingRef = useRef<Set<string>>(new Set());

  const handleNodeClick = (_: unknown, node: { id: string }) => {
    if (clickTimer.current !== null) return;
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      const current = useAppStore.getState().selectedTaskId;
      useAppStore
        .getState()
        .selectTask(current === node.id ? null : node.id);
    }, 180);
  };

  const handleNodeDoubleClick = async (
    _: unknown,
    node: { id: string; data?: { task?: Task } },
  ) => {
    if (clickTimer.current !== null) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (togglingRef.current.has(node.id)) return;
    const task = node.data?.task;
    if (!task) return;
    const next = nextStatus(task.status);
    togglingRef.current.add(node.id);
    try {
      await useAppStore.getState().updateTask(node.id, { status: next });
    } catch (err) {
      console.error('[status toggle]', err);
    } finally {
      togglingRef.current.delete(node.id);
    }
  };
```

- [ ] **Step 1.4: ReactFlow 의 onNodeClick prop 교체 + onNodeDoubleClick 추가**

`<ReactFlow ... >` 의 기존 inline `onNodeClick={(_, node) => { ... }}` 블록 전체를 다음으로 교체:

```tsx
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
```

(즉 기존 5줄짜리 인라인 함수 → 2줄로 줄어들고 더블클릭 핸들러 추가)

- [ ] **Step 1.5: 컴포넌트 unmount 시 타이머 cleanup**

`useEffect(() => { fetchTasks(); }, [fetchTasks]);` 바로 **다음 줄** 에 추가:

```tsx
  useEffect(() => {
    return () => {
      if (clickTimer.current !== null) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
    };
  }, []);
```

- [ ] **Step 1.6: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 출력 없음.

- [ ] **Step 1.7: Lint**

```bash
npx next lint
```

Expected: `✔ No ESLint warnings or errors`.

- [ ] **Step 1.8: Prettier**

```bash
npx prettier --write app/components/Canvas.tsx
```

Expected: `app/components/Canvas.tsx XXms` (unchanged 또는 자동 정렬).

- [ ] **Step 1.9: Commit**

```bash
git add app/components/Canvas.tsx
git commit -m "feat(Canvas): double-click status toggle + delayed single click (#12)"
```

---

## Task 2: Smoke verification

**Files:** (없음 — 검증)

- [ ] **Step 2.1: Vitest (regression)**

```bash
npx vitest run
```

Expected: `Test Files 2 passed (2)`, `Tests 16 passed (16)`.

- [ ] **Step 2.2: Production build**

```bash
rm -rf .next && npx next build
```

Expected: `✓ Compiled successfully`, 4 routes. `/` 사이즈는 #10 후 (~76.7 kB) 와 거의 동일.

- [ ] **Step 2.3: Dev 서버 + 브라우저 3 시나리오**

```bash
npm run dev
```

http://localhost:3000 에서:

1. **순환**: 노드 한 개 만들고 (없으면 `+ 새 태스크`로 생성) 더블클릭 3 회 → 흰(todo) → 파랑(in_progress) → 초록(done) → 흰(todo) 순환.
2. **단일 클릭 토글**: 노드 한 번 클릭 → 약 180ms 후 드로어 열림 + 노드에 주황 ring. 같은 노드 한 번 더 클릭 → ~180ms 후 드로어 닫힘, ring 사라짐.
3. **충돌 가드**: 노드를 빠르게 더블클릭 (Mac 기본 더블클릭 간격) → 드로어 안 열림 (single click 콜백 취소됨), status 만 변경.

추가 1 시나리오:
4. **드로어 열린 채 다른 노드 더블클릭**: A 클릭 → 드로어 열림 (A 폼). B 더블클릭 → B 의 status 만 바뀌고 드로어는 여전히 A 의 폼 표시. (B 더블클릭 시 single click 취소되므로 드로어 전환은 안 일어남 — 의도된 동작.)

모두 통과해야 다음 task.

- [ ] **Step 2.4: dev 서버 종료**

`Ctrl+C`.

---

## Task 3: Push + PR + Merge

- [ ] **Step 3.1: Push**

```bash
git push -u origin feature/12-status-toggle
```

- [ ] **Step 3.2: PR 생성**

```bash
gh pr create --base main --head feature/12-status-toggle --title "feat: double-click status toggle (#12)" --body "$(cat <<'EOF'
Closes #12.

## Summary
- Canvas 노드 더블클릭 → \`todo → in_progress → done → todo\` 순환
- 단일 클릭(드로어 토글) 은 180ms 지연 발화로 변경 — 더블클릭과 충돌 방지
- 노드 id 단위 inflight Set 으로 PATCH race 가드
- 에러는 console.error 만 (토스트는 #18 polish)

## Files
- \`app/components/Canvas.tsx\` — 핸들러 두 개, \`nextStatus\` inline, timer cleanup

## Test plan
- [x] \`npx tsc --noEmit\` clean
- [x] \`npx next lint\` clean
- [x] \`npx vitest run\` — 16/16 (회귀)
- [x] \`npx next build\` — 4 routes
- [x] Browser: 순환 / 단일 토글 / 더블클릭 가드 / 드로어 + 다른 노드 더블클릭 모두 정상

## Out of scope (intentional)
- 토스트 알림 → #18
- 키보드 단축키 → YAGNI
- 다중 선택 → YAGNI
- done 후속 ready 강조 → #13 / #14
EOF
)"
```

- [ ] **Step 3.3: PR 상태 확인**

```bash
gh pr view <PR번호> --json mergeable,mergeStateStatus
```

Expected: `MERGEABLE` + `CLEAN`.

- [ ] **Step 3.4: Squash merge**

```bash
gh pr merge <PR번호> --squash --delete-branch
```

- [ ] **Step 3.5: Main 동기화**

```bash
git checkout main && git pull origin main && git log --oneline -3
```

Expected: 최상단 커밋이 `feat: double-click status toggle (#12) (#PR번호)`.

- [ ] **Step 3.6: 이슈 자동 close 확인**

```bash
gh issue view 12 --json state
```

Expected: `"state":"CLOSED"`.

---

## 완료 기준

- [ ] AC 3개 모두 통과 (더블클릭 핸들러 / PATCH 후 색 갱신 / done 전환 — #13 연결은 #12 범위 아님)
- [ ] PR squash 머지 + 이슈 #12 자동 close
- [ ] main 클린
