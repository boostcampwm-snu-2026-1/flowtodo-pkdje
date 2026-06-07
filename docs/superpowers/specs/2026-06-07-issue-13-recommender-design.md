# #13 — 추천 엔진 (Ready set + 점수 계산) Design

**Status:** Approved — ready for implementation plan
**Issue:** boostcampwm-snu-2026-1/flowtodo-pkdje#13
**Depends on:** (없음 — 순수 로직)
**Related planning:** [01-project-plan.md §5](../../planning/01-project-plan.md)

## 1. Goal

DAG 의 task 들로부터 **다음에 할 작업 후보(ready set)** 를 뽑고, **다운스트림 임팩트 + 우선순위 가중합** 으로 점수를 매겨 정렬해 돌려주는 순수 함수 모듈. UI 없음. 단위 테스트로 정확성 검증.

## 2. File & API

**파일**: `lib/recommender.ts`
- 후속 #21 의 `lib/quest.ts` 는 UI 파생 함수(별점 라벨, ready 강조 등) 별도 모듈.
- `lib/recommender.ts` 는 fetch/DOM 의존 없음. `lib/tasks` 에서 타입만 import.

**Exports:**

```ts
export type Weights = { wPriority: number; wImpact: number };
export const DEFAULT_WEIGHTS: Weights = { wPriority: 0.6, wImpact: 0.4 };

export type Recommendation = {
  task: Task;
  ready: true;
  impact: number;
  score: number;
  breakdown: {
    priorityComponent: number;  // w_p · (priority/5)
    impactComponent: number;    // w_i · (impact/maxImpact), maxImpact 0 이면 0
  };
};

export class RecommenderCycleError extends Error {}

export function computeReadySet(tasks: Task[]): Task[];
export function computeImpact(tasks: Task[]): Map<string, number>;
export function computeScore(
  task: Task,
  impact: number,
  maxImpact: number,
  weights?: Weights,
): { score: number; breakdown: Recommendation['breakdown'] };

export function computeRecommendations(
  tasks: Task[],
  weights?: Weights,
): Recommendation[];
```

`computeRecommendations` 는:
1. `hasCycle(tasks)` 가드 → cycle 있으면 `RecommenderCycleError` throw
2. `computeReadySet(tasks)` 로 ready 필터
3. `computeImpact(tasks)` 로 전체 그래프의 impact map 계산 (maxImpact 도 여기서)
4. 각 ready 에 대해 `computeScore` 적용
5. 정렬 후 반환

## 3. Ready Set

```
ready(t) := t.status === 'todo' && ∀ p ∈ t.prerequisites: taskById[p]?.status === 'done'
```

- `in_progress`, `done` 은 ready 아님.
- dangling prereq (id 가 tasks 안에 없음) → 그 prereq 는 "완료" 로 간주 (서버가 cascade detach 한 직후 상태에 안전한 fallback).

## 4. Impact 알고리즘 (단일 DFS + memo)

### 4.1 정의

```
impact(t) = | { u : u 가 t 에 직간접 의존, u.status ≠ 'done' } |
```

`Task.prerequisites` 는 "이 task 가 의존하는 선행 task". 따라서 forward edge = `prereq → dependent`. impact 는 **t 의 다운스트림 중 미완료 노드 개수**.

### 4.2 구현 골자

```ts
function computeImpact(tasks: Task[]): Map<string, number> {
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
      if (!childTask) continue;
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

### 4.3 복잡도

- 각 노드 dfs 1회 진짜 계산 (memo) → O(V).
- 각 엣지 1회 순회 → O(E).
- Set merge 비용은 최악 O(V·k) (k=깊이) 인데, 정확성(여러 부모가 같은 노드를 가리킬 때 dedup)을 위해 Set 채택. flowtodo 의 그래프 크기 (수십~수백 task) 에서 허용.

### 4.4 사이클 처리

- `computeImpact` 자체는 memo 가 캐시해 무한루프는 안 빠지지만 결과가 의미 없음.
- 진입점 `computeRecommendations` 가 `hasCycle` 가드를 함. `computeImpact` 를 단독 호출하는 케이스(테스트 포함) 는 호출자 책임.

## 5. Score

### 5.1 공식

```
priorityComponent = w_p · (priority / 5)

if maxImpact === 0:
  impactComponent = 0
  score           = priorityComponent
else:
  impactComponent = w_i · (impact / maxImpact)
  score           = priorityComponent + impactComponent
```

### 5.2 가중치

- `DEFAULT_WEIGHTS = { wPriority: 0.6, wImpact: 0.4 }` — 기획서 §5.3.
- 합이 1 이라는 가정은 강요하지 않음 (#17 슬라이더가 정규화 정책 결정). recommender 는 받은 값을 그대로 곱·합산.

### 5.3 maxImpact 범위

- ready 만 보지 않고 **전체 tasks 의 impact 중 최대값**. 그래야 ready 끼리의 상대 impact 가 "전체 그래프에서 얼마나 중요한가" 로 정규화.
- 빈 배열 → maxImpact = 0.

## 6. Tie-break (정렬 규칙)

같은 score 일 때 결정적 순서:

```
1. score          DESC
2. priority       DESC
3. dueDate        ASC  (없음 → +Infinity 취급)
4. createdAt      ASC
5. id             ASC  (안정 정렬 최종 기준)
```

`dueDate` 가 비어있는 task 가 다수일 거라 4번 (createdAt) 이 실효적 보조 키. "오래된 todo 가 묻히지 않음" 효과.

## 7. Edge Cases

| 케이스 | 처리 |
|---|---|
| 빈 tasks | ready=[], impact=Map(), recommendations=[] |
| 모든 task done | ready=[], recommendations=[] |
| 사이클 입력 | `computeRecommendations` 가 `RecommenderCycleError` throw |
| Dangling prereq | "완료"로 간주 (ready 판정에 무해), impact 그래프에서는 skip |
| 모든 ready 가 leaf (maxImpact=0) | score = priorityComponent 만 |
| 같은 score 다수 | tie-break 5단계 |

## 8. Testing

**파일**: `lib/recommender.test.ts`

Mongo mock guard:
```ts
vi.mock('@/lib/mongo', () => ({ default: Promise.resolve(null) }));
```

`mkTask(id, prereqs, extra)` 헬퍼 (`lib/dag.test.ts` 와 동일 패턴).

### 케이스 (총 20개)

**`computeReadySet` (5):**
1. 빈 배열 → []
2. 단일 todo, prereq 없음 → 그 task
3. A.prereq=[B], B todo → ready 에 A 없음, B 있음
4. A.prereq=[B], B done → A ready, B 제외 (status!=='todo')
5. in_progress / done 은 ready 아님

**`computeImpact` (8):**
6. 빈 배열 → 빈 Map
7. 단일 task → { A: 0 }
8. 선형 A→B→C 모두 todo → A=2, B=1, C=0
9. 분기 A→B, A→C → A=2, B=0, C=0
10. 다이아몬드 A→B, A→C, B→D, C→D → A=3 (set dedup)
11. C done 다이아몬드 → A=2 (B,D 만 카운트), B=1 (D), C=1 (D), D=0
12. 독립 컴포넌트 A→B, C→D → A=1, B=0, C=1, D=0
13. dangling prereq (A.prereq=[ghost]) → impact 그대로 계산, A=0

**`computeScore` (3):**
14. priority=5, impact=4, maxImpact=4, default → score=1.0, breakdown 검증
15. priority=3, impact=0, maxImpact=4 → 0.36, impactComponent=0
16. maxImpact=0 → score=priorityComponent, breakdown.impactComponent=0

**`computeRecommendations` (4):**
17. 사이클 입력 (A.prereq=[B], B.prereq=[A]) → `RecommenderCycleError` throw
18. 빈 배열 → []
19. tie-break: 두 ready 가 같은 score, priority 같으면 createdAt 빠른 게 먼저
20. end-to-end: 다이아몬드 + 일부 done → ready/impact/score 정렬 결과 검증

### 회귀

- 기존 16 개 + 새 20 개 = 36 개. 새 baseline: `Test Files 3 passed (3)`, `Tests 36 passed (36)`.

## 9. Out of Scope

- 추천 패널 UI → **#14**
- 핀 / Snooze → **#15**
- 가중치 슬라이더 → **#17** (recommender 는 weights 받는 시그니처만 준비)
- `lib/quest.ts` (UI 파생: 별점 라벨, ready 강조) → **#21**
- 캐싱 / 성능 최적화 → 그래프 크기상 YAGNI

## 10. Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | 파일은 `lib/recommender.ts` | 이슈 본문 명시. #21 의 `lib/quest.ts` 는 별개. |
| 2 | 3개 단위 함수 + 1개 컴포지트 | 단위 테스트 용이 + #14 가 컴포지트만 쓰면 됨. |
| 3 | `hasCycle` 가드는 컴포지트에만 | 단위 함수는 가벼움 유지, 진입점에서만 비용. |
| 4 | maxImpact === 0 → impactComponent 0 | impact 정보가 없으면 priority 만으로 정렬. 해석 명확. |
| 5 | Tie-break 5단계 결정적 | 안정성 + "오래된 todo 가 묻히지 않음". |
| 6 | dangling prereq = "완료" 처리 | 서버 cascade detach 직후 안전한 fallback. |
| 7 | Impact Set 으로 dedup | 다이아몬드 정확성. 그래프 크기상 비용 허용. |
