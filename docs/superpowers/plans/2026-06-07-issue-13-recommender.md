# Issue #13 — 추천 엔진 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DAG 의 task 들로부터 다음 작업 후보(ready set) 를 뽑고, 다운스트림 임팩트 + 우선순위 가중합으로 점수를 매겨 정렬한 결과를 돌려주는 순수 함수 모듈을 만든다. UI 없음. 단위 테스트로 정확성 검증.

**Architecture:** `lib/recommender.ts` 가 4개 public 함수 (`computeReadySet`, `computeImpact`, `computeScore`, `computeRecommendations`) 와 1개 에러 클래스 (`RecommenderCycleError`) export. 내부에 비-export 헬퍼 `detectCycle` (client-side `Task[]` 용 3-color DFS). impact 는 단일 DFS + memo (Set 으로 dedup), score 는 가중합 (`maxImpact === 0` 시 priority 항만). 사이클 가드는 컴포지트에만. 사용자 인터페이스(#14) 가 컴포지트만 호출하면 되는 것을 목표로 한다.

**Tech Stack:** TypeScript 순수 함수 · vitest 4.1 · 기존 `lib/tasks` 의 `Task` / `Status` / `Priority` 타입

**Issue:** [#13 추천 엔진](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/13)
**Spec:** [docs/superpowers/specs/2026-06-07-issue-13-recommender-design.md](../specs/2026-06-07-issue-13-recommender-design.md)
**Branch model:** `feature/13-recommender → main` (트렁크 기반)

---

## File Structure

| File | Purpose |
|---|---|
| `lib/recommender.ts` | 신규 — 4 public 함수 + 1 에러 + DEFAULT_WEIGHTS + 내부 헬퍼. ~140줄 예상. |
| `lib/recommender.test.ts` | 신규 — 20 케이스. 4 describe 블록 (`computeReadySet`, `computeImpact`, `computeScore`, `computeRecommendations`). |

**Not changing**: store, components, API routes, server 측 hasCycle.

**Not in this plan** (의도된 누락):
- 추천 패널 UI → #14
- 핀/snooze → #15
- 가중치 슬라이더 → #17 (시그니처만 준비)
- lib/quest.ts (UI 파생) → #21
- 성능 최적화/캐싱 → YAGNI

---

## Task 0: Feature 브랜치

- [ ] **Step 0.1: main 최신화 + 분기**

```bash
git checkout main && git pull origin main && git checkout -b feature/13-recommender
```

Expected:
- `main` 동기화 (#12 머지 + #13 spec 포함)
- `Switched to a new branch 'feature/13-recommender'`

---

## Task 1: `lib/recommender.ts` 스켈레톤 + 타입

**Files:**
- Create: `lib/recommender.ts`

- [ ] **Step 1.1: 스켈레톤 작성**

`lib/recommender.ts` 를 다음 내용으로 생성:

```ts
import type { Task } from '@/lib/tasks';

export type Weights = { wPriority: number; wImpact: number };
export const DEFAULT_WEIGHTS: Weights = { wPriority: 0.6, wImpact: 0.4 };

export type Recommendation = {
  task: Task;
  ready: true;
  impact: number;
  score: number;
  breakdown: {
    priorityComponent: number;
    impactComponent: number;
  };
};

export class RecommenderCycleError extends Error {
  constructor(message = 'graph contains a cycle') {
    super(message);
    this.name = 'RecommenderCycleError';
  }
}

// ---------- public functions (구현은 후속 task) ----------

export function computeReadySet(tasks: Task[]): Task[] {
  throw new Error('not implemented');
}

export function computeImpact(tasks: Task[]): Map<string, number> {
  throw new Error('not implemented');
}

export function computeScore(
  task: Task,
  impact: number,
  maxImpact: number,
  weights: Weights = DEFAULT_WEIGHTS,
): { score: number; breakdown: Recommendation['breakdown'] } {
  throw new Error('not implemented');
}

export function computeRecommendations(
  tasks: Task[],
  weights: Weights = DEFAULT_WEIGHTS,
): Recommendation[] {
  throw new Error('not implemented');
}
```

- [ ] **Step 1.2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 출력 없음.

---

## Task 2: `computeReadySet` (TDD)

**Files:**
- Create: `lib/recommender.test.ts`
- Modify: `lib/recommender.ts`

- [ ] **Step 2.1: 테스트 파일 + `computeReadySet` 5 케이스 작성**

`lib/recommender.test.ts` 를 다음 내용으로 생성:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '@/lib/tasks';

// mongo guard (lib/recommender 는 import 안 하지만 transitive 안전)
vi.mock('@/lib/mongo', () => ({ default: Promise.resolve(null) }));

import { computeReadySet } from '@/lib/recommender';

function mkTask(
  id: string,
  prereqs: string[] = [],
  extra: Partial<Task> = {},
): Task {
  return {
    id,
    title: `task-${id}`,
    status: 'todo',
    priority: 3,
    prerequisites: prereqs,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

describe('computeReadySet', () => {
  it('returns empty for empty input', () => {
    expect(computeReadySet([])).toEqual([]);
  });

  it('returns single todo with no prereqs', () => {
    const ready = computeReadySet([mkTask('a')]);
    expect(ready.map((t) => t.id)).toEqual(['a']);
  });

  it('excludes task whose prereq is still todo', () => {
    const ready = computeReadySet([mkTask('a', ['b']), mkTask('b')]);
    expect(ready.map((t) => t.id).sort()).toEqual(['b']);
  });

  it('includes task when its prereq is done', () => {
    const ready = computeReadySet([
      mkTask('a', ['b']),
      mkTask('b', [], { status: 'done' }),
    ]);
    expect(ready.map((t) => t.id)).toEqual(['a']);
  });

  it('excludes in_progress and done from ready', () => {
    const ready = computeReadySet([
      mkTask('a'),
      mkTask('b', [], { status: 'in_progress' }),
      mkTask('c', [], { status: 'done' }),
    ]);
    expect(ready.map((t) => t.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 2.2: 실패 확인**

```bash
npx vitest run lib/recommender.test.ts
```

Expected: 5 케이스 모두 FAIL — `not implemented`.

- [ ] **Step 2.3: `computeReadySet` 구현**

`lib/recommender.ts` 의 `computeReadySet` 함수 body 를 다음으로 교체:

```ts
export function computeReadySet(tasks: Task[]): Task[] {
  const statusById = new Map(tasks.map((t) => [t.id, t.status]));
  return tasks.filter((t) => {
    if (t.status !== 'todo') return false;
    for (const p of t.prerequisites) {
      const s = statusById.get(p);
      if (s === undefined) continue; // dangling = 완료로 간주
      if (s !== 'done') return false;
    }
    return true;
  });
}
```

- [ ] **Step 2.4: 통과 확인**

```bash
npx vitest run lib/recommender.test.ts
```

Expected: `5 passed`.

---

## Task 3: `computeImpact` (TDD)

**Files:**
- Modify: `lib/recommender.test.ts`, `lib/recommender.ts`

- [ ] **Step 3.1: import 추가**

`lib/recommender.test.ts` 의 import 라인을 다음으로 교체 (기존 `computeReadySet` 단독 import 를 확장):

```ts
import { computeImpact, computeReadySet } from '@/lib/recommender';
```

- [ ] **Step 3.2: `computeImpact` 8 케이스 추가**

`lib/recommender.test.ts` 끝에 다음 블록 추가:

```ts
describe('computeImpact', () => {
  it('returns empty map for empty input', () => {
    expect(computeImpact([]).size).toBe(0);
  });

  it('returns 0 for single task with no prereqs', () => {
    const m = computeImpact([mkTask('a')]);
    expect(m.get('a')).toBe(0);
  });

  it('linear chain A→B→C: A=2, B=1, C=0', () => {
    const m = computeImpact([
      mkTask('a'),
      mkTask('b', ['a']),
      mkTask('c', ['b']),
    ]);
    expect(m.get('a')).toBe(2);
    expect(m.get('b')).toBe(1);
    expect(m.get('c')).toBe(0);
  });

  it('branching A→B, A→C: A=2, B=0, C=0', () => {
    const m = computeImpact([
      mkTask('a'),
      mkTask('b', ['a']),
      mkTask('c', ['a']),
    ]);
    expect(m.get('a')).toBe(2);
    expect(m.get('b')).toBe(0);
    expect(m.get('c')).toBe(0);
  });

  it('diamond A→B, A→C, B→D, C→D: A=3 (deduped via Set)', () => {
    const m = computeImpact([
      mkTask('a'),
      mkTask('b', ['a']),
      mkTask('c', ['a']),
      mkTask('d', ['b', 'c']),
    ]);
    expect(m.get('a')).toBe(3);
    expect(m.get('b')).toBe(1);
    expect(m.get('c')).toBe(1);
    expect(m.get('d')).toBe(0);
  });

  it('diamond with C done: done not counted in impact', () => {
    const m = computeImpact([
      mkTask('a'),
      mkTask('b', ['a']),
      mkTask('c', ['a'], { status: 'done' }),
      mkTask('d', ['b', 'c']),
    ]);
    // A 의 다운스트림 = {B, C(done), D}. done 인 C 만 제외 → {B, D} = 2
    expect(m.get('a')).toBe(2);
    expect(m.get('b')).toBe(1); // D
    expect(m.get('c')).toBe(1); // D
    expect(m.get('d')).toBe(0);
  });

  it('independent components A→B, C→D: A=1, B=0, C=1, D=0', () => {
    const m = computeImpact([
      mkTask('a'),
      mkTask('b', ['a']),
      mkTask('c'),
      mkTask('d', ['c']),
    ]);
    expect(m.get('a')).toBe(1);
    expect(m.get('b')).toBe(0);
    expect(m.get('c')).toBe(1);
    expect(m.get('d')).toBe(0);
  });

  it('dangling prereq: ignored, impact stays consistent', () => {
    // A 의 prereq=[ghost] 인데 ghost 는 tasks 에 없음.
    // → ghost 는 그래프에 없으니 A 의 다운스트림에 아무 영향 없음. A=0.
    const m = computeImpact([mkTask('a', ['ghost'])]);
    expect(m.get('a')).toBe(0);
  });
});
```

- [ ] **Step 3.3: 실패 확인**

```bash
npx vitest run lib/recommender.test.ts
```

Expected: 8 케이스 FAIL — `not implemented`.

- [ ] **Step 3.4: `computeImpact` 구현**

`lib/recommender.ts` 의 `computeImpact` 함수 body 를 다음으로 교체:

```ts
export function computeImpact(tasks: Task[]): Map<string, number> {
  const downstream = new Map<string, string[]>();
  for (const t of tasks) {
    for (const p of t.prerequisites) {
      if (!downstream.has(p)) downstream.set(p, []);
      downstream.get(p)!.push(t.id);
    }
  }

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map<string, Set<string>>();

  function dfs(id: string): Set<string> {
    const cached = memo.get(id);
    if (cached) return cached;

    const result = new Set<string>();
    for (const child of downstream.get(id) ?? []) {
      const childTask = taskById.get(child);
      if (!childTask) continue; // dangling
      if (childTask.status !== 'done') result.add(child);
      for (const grand of dfs(child)) result.add(grand);
    }
    memo.set(id, result);
    return result;
  }

  const out = new Map<string, number>();
  for (const t of tasks) out.set(t.id, dfs(t.id).size);
  return out;
}
```

- [ ] **Step 3.5: 통과 확인**

```bash
npx vitest run lib/recommender.test.ts
```

Expected: 13 passed (5 + 8).

---

## Task 4: `computeScore` (TDD)

**Files:**
- Modify: `lib/recommender.test.ts`, `lib/recommender.ts`

- [ ] **Step 4.1: import 확장**

`lib/recommender.test.ts` 의 import 라인을 다음으로 교체:

```ts
import {
  computeImpact,
  computeReadySet,
  computeScore,
  DEFAULT_WEIGHTS,
} from '@/lib/recommender';
```

- [ ] **Step 4.2: 3 케이스 추가**

파일 끝에 다음 블록 추가:

```ts
describe('computeScore', () => {
  it('priority=5, impact=4, maxImpact=4 → score=1.0', () => {
    const task = mkTask('a', [], { priority: 5 });
    const { score, breakdown } = computeScore(task, 4, 4);
    expect(score).toBeCloseTo(1.0, 5);
    expect(breakdown.priorityComponent).toBeCloseTo(0.6, 5);
    expect(breakdown.impactComponent).toBeCloseTo(0.4, 5);
  });

  it('priority=3, impact=0, maxImpact=4 → score=0.36', () => {
    const task = mkTask('a', [], { priority: 3 });
    const { score, breakdown } = computeScore(task, 0, 4);
    expect(score).toBeCloseTo(0.36, 5);
    expect(breakdown.priorityComponent).toBeCloseTo(0.36, 5);
    expect(breakdown.impactComponent).toBeCloseTo(0, 5);
  });

  it('maxImpact=0 → impactComponent=0, score=priorityComponent', () => {
    const task = mkTask('a', [], { priority: 4 });
    const { score, breakdown } = computeScore(task, 0, 0);
    // w_p · 4/5 = 0.6 · 0.8 = 0.48
    expect(score).toBeCloseTo(0.48, 5);
    expect(breakdown.priorityComponent).toBeCloseTo(0.48, 5);
    expect(breakdown.impactComponent).toBe(0);
  });
});
```

- [ ] **Step 4.3: 실패 확인**

```bash
npx vitest run lib/recommender.test.ts
```

Expected: 3 FAIL — `not implemented`.

- [ ] **Step 4.4: `computeScore` 구현**

`lib/recommender.ts` 의 `computeScore` 함수 body 를 다음으로 교체:

```ts
export function computeScore(
  task: Task,
  impact: number,
  maxImpact: number,
  weights: Weights = DEFAULT_WEIGHTS,
): { score: number; breakdown: Recommendation['breakdown'] } {
  const priorityComponent = weights.wPriority * (task.priority / 5);
  const impactComponent =
    maxImpact === 0 ? 0 : weights.wImpact * (impact / maxImpact);
  return {
    score: priorityComponent + impactComponent,
    breakdown: { priorityComponent, impactComponent },
  };
}
```

- [ ] **Step 4.5: 통과 확인**

```bash
npx vitest run lib/recommender.test.ts
```

Expected: 16 passed (5 + 8 + 3).

---

## Task 5: `detectCycle` + `computeRecommendations` (TDD)

**Files:**
- Modify: `lib/recommender.test.ts`, `lib/recommender.ts`

- [ ] **Step 5.1: import 확장**

`lib/recommender.test.ts` 의 import 라인을 다음으로 교체:

```ts
import {
  computeImpact,
  computeReadySet,
  computeRecommendations,
  computeScore,
  DEFAULT_WEIGHTS,
  RecommenderCycleError,
} from '@/lib/recommender';
```

- [ ] **Step 5.2: 4 케이스 추가**

파일 끝에 다음 블록 추가:

```ts
describe('computeRecommendations', () => {
  it('throws RecommenderCycleError on cyclic input', () => {
    const tasks = [mkTask('a', ['b']), mkTask('b', ['a'])];
    expect(() => computeRecommendations(tasks)).toThrow(RecommenderCycleError);
  });

  it('returns empty for empty input', () => {
    expect(computeRecommendations([])).toEqual([]);
  });

  it('tie-break: same score, same priority → earlier createdAt first', () => {
    // 둘 다 leaf, priority=3 → maxImpact=0 → 점수 동일.
    // createdAt 빠른 게 먼저.
    const tasks = [
      mkTask('a', [], { createdAt: '2026-02-01T00:00:00.000Z' }),
      mkTask('b', [], { createdAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const recs = computeRecommendations(tasks);
    expect(recs.map((r) => r.task.id)).toEqual(['b', 'a']);
  });

  it('end-to-end diamond with one done: ordering reflects ready+score', () => {
    // 다이아몬드: A→B, A→C, B→D, C→D. A 가 done. 나머지 todo.
    // ready = B, C (A done 이므로). D 는 B,C 가 todo 라서 아직 ready 아님.
    // impact: A=3 (B,C,D), B=1 (D), C=1 (D), D=0
    // maxImpact=3. ready 의 score:
    //   B (priority=3): 0.6·0.6 + 0.4·(1/3) = 0.36 + 0.1333 = 0.4933
    //   C (priority=4): 0.6·0.8 + 0.4·(1/3) = 0.48 + 0.1333 = 0.6133
    // → C 가 1등, B 가 2등.
    const tasks = [
      mkTask('a', [], { status: 'done', priority: 3 }),
      mkTask('b', ['a'], { priority: 3 }),
      mkTask('c', ['a'], { priority: 4 }),
      mkTask('d', ['b', 'c'], { priority: 5 }),
    ];
    const recs = computeRecommendations(tasks);
    expect(recs.map((r) => r.task.id)).toEqual(['c', 'b']);
    expect(recs[0].impact).toBe(1);
    expect(recs[0].score).toBeGreaterThan(recs[1].score);
  });
});
```

- [ ] **Step 5.3: 실패 확인**

```bash
npx vitest run lib/recommender.test.ts
```

Expected: 4 FAIL — `not implemented`.

- [ ] **Step 5.4: `detectCycle` 내부 헬퍼 + `computeRecommendations` 구현**

`lib/recommender.ts` 의 파일 끝(또는 `computeRecommendations` 바로 위)에 내부 헬퍼 추가:

```ts
function detectCycle(tasks: Task[]): boolean {
  type Color = 'white' | 'gray' | 'black';
  const color = new Map<string, Color>();
  const prereqMap = new Map<string, string[]>();

  for (const t of tasks) {
    color.set(t.id, 'white');
    prereqMap.set(t.id, t.prerequisites);
  }

  function dfs(id: string): boolean {
    color.set(id, 'gray');
    for (const p of prereqMap.get(id) ?? []) {
      if (!color.has(p)) continue; // dangling
      const c = color.get(p);
      if (c === 'gray') return true;
      if (c === 'white' && dfs(p)) return true;
    }
    color.set(id, 'black');
    return false;
  }

  for (const t of tasks) {
    if (color.get(t.id) === 'white' && dfs(t.id)) return true;
  }
  return false;
}
```

그리고 `computeRecommendations` 함수 body 를 다음으로 교체:

```ts
export function computeRecommendations(
  tasks: Task[],
  weights: Weights = DEFAULT_WEIGHTS,
): Recommendation[] {
  if (detectCycle(tasks)) {
    throw new RecommenderCycleError();
  }

  const ready = computeReadySet(tasks);
  if (ready.length === 0) return [];

  const impactMap = computeImpact(tasks);
  let maxImpact = 0;
  for (const v of impactMap.values()) {
    if (v > maxImpact) maxImpact = v;
  }

  const recs: Recommendation[] = ready.map((task) => {
    const impact = impactMap.get(task.id) ?? 0;
    const { score, breakdown } = computeScore(
      task,
      impact,
      maxImpact,
      weights,
    );
    return { task, ready: true, impact, score, breakdown };
  });

  recs.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.task.priority !== a.task.priority) {
      return b.task.priority - a.task.priority;
    }
    const aDue = a.task.dueDate ? Date.parse(a.task.dueDate) : Infinity;
    const bDue = b.task.dueDate ? Date.parse(b.task.dueDate) : Infinity;
    if (aDue !== bDue) return aDue - bDue;
    const aCreated = Date.parse(a.task.createdAt);
    const bCreated = Date.parse(b.task.createdAt);
    if (aCreated !== bCreated) return aCreated - bCreated;
    return a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0;
  });

  return recs;
}
```

- [ ] **Step 5.5: 통과 확인 + 전체 회귀**

```bash
npx vitest run
```

Expected: `Test Files 3 passed (3)`, `Tests 36 passed (36)` (기존 16 + recommender 20).

---

## Task 6: 자동 검증

- [ ] **Step 6.1: Prettier**

```bash
npx prettier --write lib/recommender.ts lib/recommender.test.ts
```

Expected: 두 파일 unchanged 또는 자동 정렬.

- [ ] **Step 6.2: ESLint**

```bash
npx next lint
```

Expected: `✔ No ESLint warnings or errors`.

- [ ] **Step 6.3: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 출력 없음.

- [ ] **Step 6.4: Production build (회귀)**

```bash
rm -rf .next && npx next build
```

Expected: `✓ Compiled successfully`, 4 routes. `/` 사이즈는 #12 후와 동일 (lib/recommender 가 아직 UI 에 안 import).

- [ ] **Step 6.5: 전체 vitest 한번 더**

```bash
npx vitest run
```

Expected: `Tests 36 passed (36)`.

---

## Task 7: Commit / Push / PR / Merge

- [ ] **Step 7.1: Plan 문서 commit (선택, plan 파일 untracked 라면)**

```bash
git add docs/superpowers/plans/2026-06-07-issue-13-recommender.md
git commit -m "docs: add #13 recommender implementation plan"
```

- [ ] **Step 7.2: 구현 commit**

```bash
git add lib/recommender.ts lib/recommender.test.ts
git commit -m "$(cat <<'EOF'
feat(recommender): ready set, impact, score, recommendations (#13)

- computeReadySet: status==='todo' && all prereqs done (dangling = done)
- computeImpact: forward DFS + memo with Set dedup, O(V+E) typical
- computeScore: w_p · priority/5 + w_i · impact/maxImpact;
  impactComponent forced to 0 when maxImpact === 0
- computeRecommendations: detectCycle guard → ready → impact → score,
  sorted by score desc → priority desc → dueDate asc → createdAt asc → id asc
- RecommenderCycleError on cyclic input
- Internal detectCycle helper (client-side Task[] 3-color DFS) because
  lib/tasks.hasCycle is server-side TaskDoc/ObjectId shaped

20 vitest cases covering empty/linear/branching/diamond/done/dangling/
cycle/tie-break/end-to-end.
EOF
)"
```

- [ ] **Step 7.3: Push**

```bash
git push -u origin feature/13-recommender
```

- [ ] **Step 7.4: PR 생성**

```bash
gh pr create --base main --head feature/13-recommender --title "feat: recommender engine (#13)" --body "$(cat <<'EOF'
Closes #13.

## Summary
- 신규 \`lib/recommender.ts\` — 4 public 함수 + RecommenderCycleError + DEFAULT_WEIGHTS
- 신규 \`lib/recommender.test.ts\` — 20 케이스

## Algorithm
- Ready: todo && all prereqs done (dangling=done)
- Impact: forward DFS + memo + Set dedup. O(V+E) for typical small graphs.
- Score: w_p·(p/5) + w_i·(impact/maxImpact); fallback to priority-only when maxImpact===0.
- Sort: score → priority → dueDate → createdAt → id (decisive, stable).
- Cycle guard at composite entry; lib/tasks.hasCycle 은 ObjectId 시그니처라 client-side detectCycle 헬퍼를 새로 둠.

## Files
- \`lib/recommender.ts\`
- \`lib/recommender.test.ts\`

## Test plan
- [x] \`npx tsc --noEmit\` clean
- [x] \`npx next lint\` clean
- [x] \`npx vitest run\` — 36/36 (기존 16 + 신규 20)
- [x] \`npx next build\` — 4 routes (lib/recommender 는 UI 미사용 → 번들 차이 없음)

## Out of scope (intentional)
- 추천 패널 UI → #14
- 핀/snooze → #15
- 가중치 슬라이더 → #17
- lib/quest.ts (UI 파생) → #21
EOF
)"
```

- [ ] **Step 7.5: PR 상태 확인**

```bash
gh pr view <PR번호> --json mergeable,mergeStateStatus
```

Expected: `MERGEABLE` + `CLEAN`.

- [ ] **Step 7.6: Squash merge**

```bash
gh pr merge <PR번호> --squash --delete-branch
```

- [ ] **Step 7.7: Main 동기화**

```bash
git checkout main && git pull origin main && git log --oneline -3
```

Expected: 최상단 `feat: recommender engine (#13) (#PR번호)`.

- [ ] **Step 7.8: 이슈 자동 close 확인**

```bash
gh issue view 13 --json state
```

Expected: `"state":"CLOSED"`.

---

## 완료 기준

- [ ] AC 3개 모두 통과 (3 export + DFS memo O(V+E) + 단위 테스트)
- [ ] PR squash 머지 + 이슈 #13 자동 close
- [ ] `Test Files 3 passed (3)`, `Tests 36 passed (36)` 새 baseline
- [ ] main 클린
