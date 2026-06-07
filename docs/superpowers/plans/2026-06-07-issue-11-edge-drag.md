# Issue #11 — 의존성 엣지 드래그/삭제 + 사이클 방지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Canvas 의 노드 핸들에서 드래그로 의존성 엣지를 생성하고, 엣지 클릭 + confirm 으로 삭제한다. 사이클이 생기는 드래그는 React Flow `isValidConnection` 으로 드래그 중부터 빨강 점선 + drop 거부, `onConnect` 가 한 번 더 가드.

**Architecture:** **A) lib/recommender 확장** — 신규 `wouldCreateCycle(tasks, source, target): boolean` export. 내부적으로 가상 엣지를 추가한 사본을 만들어 기존 비-export `detectCycle` 에 넘김. **B) Canvas 통합** — 3개 콜백 (`isValidConnection`, `onConnect`, `onEdgeClick`) + 1.6초 우상단 토스트 + `deleteKeyCode={null}`. 모든 변경은 `store.updateTask(target, { prerequisites })` 한 줄로 귀결.

**Tech Stack:** React Flow 11 `onConnect` / `isValidConnection` / `onEdgeClick` · 기존 Zustand store · 기존 lib/recommender 내부 detectCycle

**Issue:** [#11 의존성 엣지 생성/삭제 + 사이클 방지](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/11)
**Spec:** [docs/superpowers/specs/2026-06-07-issue-11-edge-drag-design.md](../specs/2026-06-07-issue-11-edge-drag-design.md)
**Branch model:** `feature/11-edge-drag → main` (트렁크 기반)

---

## File Structure

| File | Purpose |
|---|---|
| `lib/recommender.ts` | `wouldCreateCycle(tasks, source, target): boolean` 신규 export. 빠른 경로 3개 + detectCycle 위임. |
| `lib/recommender.test.ts` | `wouldCreateCycle` 4 케이스 추가. 새 baseline 43. |
| `app/components/Canvas.tsx` | `onConnect` / `isValidConnection` / `onEdgeClick` 콜백 + 1.6초 우상단 빨강 토스트 + `deleteKeyCode={null}`. |

**Not in this plan** (의도된 누락):
- Backspace 키로 엣지 삭제 → 의도적 비활성. 커스텀 confirm 모달은 #18.
- 토스트 인프라 도입 → #18
- 다중 엣지 선택/삭제 → YAGNI
- 엣지 라벨/타입 변경 → YAGNI

---

## Task 0: Feature 브랜치

- [ ] **Step 0.1: main 최신화 + 분기**

```bash
git checkout main && git pull origin main && git checkout -b feature/11-edge-drag
```

Expected:
- `main` 동기화 (#14 머지 + #11 spec 포함)
- `Switched to a new branch 'feature/11-edge-drag'`

---

## Task 1: `wouldCreateCycle` (TDD)

**Files:**
- Modify: `lib/recommender.test.ts`, `lib/recommender.ts`

- [ ] **Step 1.1: import 확장**

`lib/recommender.test.ts` 의 import 라인을 다음으로 교체:

```ts
import {
  computeImpact,
  computeImpactSet,
  computeReadySet,
  computeRecommendations,
  computeScore,
  RecommenderCycleError,
  wouldCreateCycle,
} from '@/lib/recommender';
```

- [ ] **Step 1.2: 4 케이스 추가 (파일 끝에)**

`lib/recommender.test.ts` 끝에 다음 describe 블록 추가:

```ts
describe('wouldCreateCycle', () => {
  it('self-loop A→A is a cycle', () => {
    expect(wouldCreateCycle([mkTask('a')], 'a', 'a')).toBe(true);
  });

  it('A→B in independent graph is not a cycle', () => {
    expect(wouldCreateCycle([mkTask('a'), mkTask('b')], 'a', 'b')).toBe(false);
  });

  it('A→B when A.prereq already includes B → would create cycle', () => {
    // A.prereq=[B] 이미 있음 (즉 B→A 엣지). 새로 A→B 추가하면 사이클.
    const tasks = [mkTask('a', ['b']), mkTask('b')];
    expect(wouldCreateCycle(tasks, 'a', 'b')).toBe(true);
  });

  it('indirect cycle: A→B→C chain, adding C→A creates cycle', () => {
    // 의존성 방향: A 가 시작, B 는 A 필요, C 는 B 필요.
    // C→A 엣지 = A.prereq 에 C 추가 → A 가 C 에 의존, C 는 B 경유로 A 에 의존 → 사이클.
    const tasks = [mkTask('a'), mkTask('b', ['a']), mkTask('c', ['b'])];
    expect(wouldCreateCycle(tasks, 'c', 'a')).toBe(true);
  });
});
```

- [ ] **Step 1.3: 실패 확인**

```bash
npx vitest run lib/recommender.test.ts
```

Expected: 4 케이스 FAIL — `wouldCreateCycle is not a function` 또는 import 에러.

- [ ] **Step 1.4: 구현**

`lib/recommender.ts` 의 `detectCycle` 함수 **다음 줄** 에 새 export 함수 추가:

```ts
export function wouldCreateCycle(
  tasks: Task[],
  source: string,
  target: string,
): boolean {
  // 자기 자신을 prereq → 즉시 사이클
  if (source === target) return true;

  const targetTask = tasks.find((t) => t.id === target);
  if (!targetTask) return false; // target 자체가 없으면 추가 불가
  if (targetTask.prerequisites.includes(source)) return false; // 이미 있는 엣지 → 변화 없음
  if (!tasks.some((t) => t.id === source)) return false; // dangling source → 사이클 불가

  const candidate = tasks.map((t) =>
    t.id === target
      ? { ...t, prerequisites: [...t.prerequisites, source] }
      : t,
  );
  return detectCycle(candidate);
}
```

- [ ] **Step 1.5: 통과 + 회귀 확인**

```bash
npx vitest run
```

Expected: `Test Files 3 passed (3)`, `Tests 43 passed (43)` (기존 39 + 신규 4).

- [ ] **Step 1.6: Commit**

```bash
git add lib/recommender.ts lib/recommender.test.ts
git commit -m "feat(recommender): add wouldCreateCycle for client-side guard (#11)"
```

---

## Task 2: Canvas — 토스트 상태 + 헬퍼

**Files:**
- Modify: `app/components/Canvas.tsx`

- [ ] **Step 2.1: import 확장**

[app/components/Canvas.tsx](app/components/Canvas.tsx) 의 상단 import 들을 다음으로 교체:

```tsx
'use client';

import 'reactflow/dist/style.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
} from 'reactflow';
import { TaskNode } from './TaskNode';
import { applyLayout, buildGraph } from '@/lib/dag';
import { useAppStore } from '@/lib/store';
import { wouldCreateCycle } from '@/lib/recommender';
import type { Status, Task } from '@/lib/tasks';
```

- [ ] **Step 2.2: edgeError state + showError 헬퍼 추가**

`Canvas()` 함수 본문의 기존 `clickTimer` / `togglingRef` 선언 **다음 줄** 에 다음 블록 추가:

```tsx
  const [edgeError, setEdgeError] = useState<string | null>(null);
  const errorTimerRef = useRef<number | null>(null);

  function showError(msg: string) {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setEdgeError(msg);
    errorTimerRef.current = window.setTimeout(() => {
      setEdgeError(null);
      errorTimerRef.current = null;
    }, 1600);
  }
```

- [ ] **Step 2.3: cleanup useEffect 확장**

기존 cleanup useEffect (clickTimer cleanup) 의 return 안에 errorTimer cleanup 도 추가:

```tsx
  useEffect(() => {
    return () => {
      if (clickTimer.current !== null) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
      if (errorTimerRef.current !== null) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
    };
  }, []);
```

- [ ] **Step 2.4: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 출력 없음.

---

## Task 3: Canvas — 3개 콜백 + ReactFlow 부착

**Files:**
- Modify: `app/components/Canvas.tsx`

- [ ] **Step 3.1: 콜백 3개 추가**

`Canvas()` 함수 본문에서 기존 `handleNodeDoubleClick` 정의 **다음 줄** 에 다음 블록 추가:

```tsx
  const isValidConnection = (conn: Connection) => {
    const tasksNow = useAppStore.getState().tasks;
    if (!conn.source || !conn.target) return false;
    return !wouldCreateCycle(tasksNow, conn.source, conn.target);
  };

  const onConnect = async (conn: Connection) => {
    if (!conn.source || !conn.target) return;
    const tasksNow = useAppStore.getState().tasks;
    if (wouldCreateCycle(tasksNow, conn.source, conn.target)) {
      showError('순환 의존성이 생겨 거부됨');
      return;
    }
    const target = tasksNow.find((t) => t.id === conn.target);
    if (!target) return;
    if (target.prerequisites.includes(conn.source)) return; // 중복 silent
    try {
      await useAppStore.getState().updateTask(target.id, {
        prerequisites: [...target.prerequisites, conn.source],
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  const onEdgeClick = async (_: unknown, edge: Edge) => {
    const ok = window.confirm('이 의존성을 삭제할까요?');
    if (!ok) return;
    const tasksNow = useAppStore.getState().tasks;
    const target = tasksNow.find((t) => t.id === edge.target);
    if (!target) return;
    try {
      await useAppStore.getState().updateTask(target.id, {
        prerequisites: target.prerequisites.filter((p) => p !== edge.source),
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };
```

- [ ] **Step 3.2: ReactFlow prop 추가**

`<ReactFlow ... >` 의 prop 들 사이에 다음 4개 prop 추가 (`onNodeDoubleClick={handleNodeDoubleClick}` 다음 줄들):

```tsx
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          isValidConnection={isValidConnection}
          deleteKeyCode={null}
```

- [ ] **Step 3.3: 토스트 UI 추가**

`<main>` 의 자식들 중 `<ReactFlow>` 바로 **다음 줄** (또는 `<ReactFlow>` 와 `<CenterMessage>` 사이) 에 추가:

```tsx
      {edgeError && (
        <div className="absolute right-4 top-4 z-10 rounded-md bg-red-500 px-3 py-2 text-xs font-medium text-white shadow-lg">
          {edgeError}
        </div>
      )}
```

- [ ] **Step 3.4: 자동 검증**

```bash
npx prettier --write app/components/Canvas.tsx && npx tsc --noEmit && npx next lint
```

Expected: prettier ok + tsc 출력 없음 + `✔ No ESLint warnings or errors`.

- [ ] **Step 3.5: Vitest 회귀**

```bash
npx vitest run
```

Expected: `Tests 43 passed (43)`.

- [ ] **Step 3.6: Production build**

```bash
rm -rf .next && npx next build
```

Expected: `✓ Compiled successfully`, 4 routes.

---

## Task 4: Browser smoke (수동, 8 시나리오)

```bash
npm run dev
```

http://localhost:3000 에서:

1. **엣지 생성 — 정상**: A, B 두 노드 만들기 (prereq 없음, priority 어떤 값이든). A 의 **bottom handle** → B 의 **top handle** 드래그 → drop. 엣지 등장. 드로어로 B 열어 prereq 에 A 가 있는지 확인.
2. **사이클 차단 — 직접**: A→B 인 상태에서 B 의 bottom handle → A 의 top handle 드래그 → 드래그 중 라인이 **빨강 점선** → drop 해도 변화 없음. 토스트 없음 (isValidConnection 단계라).
3. **사이클 차단 — 간접**: 추가로 C 를 B 의 dependent 로 만들기 (A→B→C). C → A 드래그 → 빨강 → drop 거부.
4. **자기 자신**: A 의 bottom handle → A 의 top handle 드래그 → 빨강 점선.
5. **중복 엣지**: 이미 A→B 인 상태에서 A→B 다시 드래그 → drop 시 store 변화 없음 (silent).
6. **엣지 삭제 — 정상**: 기존 엣지 클릭 → confirm `"이 의존성을 삭제할까요?"` → OK → 엣지 사라짐. 드로어 / NextQuestPanel 즉시 갱신.
7. **엣지 삭제 — 취소**: 엣지 클릭 → confirm 취소 → 변화 없음.
8. **토스트 페이드**: 사이클 시도가 onConnect 까지 도달 (드물게 isValidConnection 우회되는 케이스 — 작위적으로 만들기 어려움. **선택 시나리오**: dev tools 로 임시 검증 또는 skip).

추가 회귀:
- 노드 단일 클릭 → 드로어 토글 (#10) 정상
- 더블클릭 → status 순환 (#12) 정상
- NextQuestPanel 카드 클릭 → 카메라 이동 (#14) 정상

모두 통과해야 다음 단계.

- [ ] dev 서버 종료 (Ctrl+C)

---

## Task 5: Commit + Push + PR + Merge

- [ ] **Step 5.1: Canvas 변경 commit**

```bash
git add app/components/Canvas.tsx
git commit -m "$(cat <<'EOF'
feat(Canvas): edge drag/delete with cycle guard (#11)

- isValidConnection uses wouldCreateCycle so React Flow shows a red
  dashed line as soon as the user drags toward a node that would form
  a cycle, and drops are silently rejected.
- onConnect re-checks (defensive), then store.updateTask appends the
  source id to target.prerequisites. Duplicate-edge drops are no-ops.
- onEdgeClick uses window.confirm and removes the source from
  target.prerequisites via the same store action.
- 1.6s upper-right red toast surfaces cycle/network errors that slip
  through the validation layer. Auto-clears via timeout; cleaned up on
  unmount alongside the existing click timer.
- deleteKeyCode={null} disables React Flow's default Backspace
  shortcut so users can't bypass the confirm dialog.
EOF
)"
```

- [ ] **Step 5.2: Plan 문서 commit**

```bash
git add docs/superpowers/plans/2026-06-07-issue-11-edge-drag.md
git commit -m "docs: add #11 edge drag implementation plan"
```

- [ ] **Step 5.3: Push**

```bash
git push -u origin feature/11-edge-drag
```

- [ ] **Step 5.4: PR 생성**

```bash
gh pr create --base main --head feature/11-edge-drag --title "feat: edge drag/delete with cycle guard (#11)" --body "$(cat <<'EOF'
Closes #11.

## Summary
- 노드 핸들에서 드래그 → 의존성 엣지 생성. \`store.updateTask\` 로 prereq 추가.
- 엣지 클릭 → \`window.confirm\` → \`store.updateTask\` 로 prereq 제거.
- 신규 \`wouldCreateCycle(tasks, source, target)\` 로 사이클 가드. \`isValidConnection\` + \`onConnect\` 양쪽.
- 사이클 / 네트워크 에러는 우상단 1.6초 빨강 토스트.
- \`deleteKeyCode={null}\` 로 Backspace 자동 삭제 비활성 (confirm 우회 차단).

## Test plan
- [x] \`npx tsc --noEmit\` clean
- [x] \`npx next lint\` clean
- [x] \`npx vitest run\` — 43/43 (기존 39 + 신규 4)
- [x] \`npx next build\` — 4 routes
- [x] Browser smoke 8 시나리오 + 회귀 (#10/#12/#14) — 모두 정상

## Out of scope (intentional)
- Backspace 키 삭제 → #18 (커스텀 모달과 함께)
- 토스트 인프라 도입 → #18
- 다중 엣지 선택 → YAGNI
EOF
)"
```

- [ ] **Step 5.5: PR 상태 확인**

```bash
gh pr view <PR번호> --json mergeable,mergeStateStatus
```

Expected: `MERGEABLE` + `CLEAN`.

- [ ] **Step 5.6: Squash merge**

```bash
gh pr merge <PR번호> --squash --delete-branch
```

- [ ] **Step 5.7: Main 동기화**

```bash
git checkout main && git pull origin main && git log --oneline -3
```

Expected: 최상단 `feat: edge drag/delete with cycle guard (#11) (#PR번호)`.

- [ ] **Step 5.8: 이슈 자동 close 확인**

```bash
gh issue view 11 --json state
```

Expected: `"state":"CLOSED"`.

---

## 완료 기준

- [ ] AC 4개 모두 통과 (connect handler DFS / 빨갛게 깜빡 / 생성 시 PATCH / 삭제 시 confirm + PATCH)
- [ ] PR squash 머지 + 이슈 #11 자동 close
- [ ] `Tests 43 passed (43)` 새 baseline
- [ ] main 클린
- [ ] Week 2 완료 — 모든 week-2 이슈 close
