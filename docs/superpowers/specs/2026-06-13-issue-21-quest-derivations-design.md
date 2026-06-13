# #21 — lib/quest.ts (퀘스트 게임 UI 파생 함수) Design

**Status:** Approved (user delegated decisions)
**Issue:** #21
**Related:** [04-quest-game-ui.md §4](../../planning/04-quest-game-ui.md)

## 1. Goal

퀘스트 게임 UI 의 모든 파생 계산을 순수 함수로 모은 `lib/quest.ts`. UI 의존 없음. TDD.

## 2. API

```ts
export type Component = { id: string; taskIds: string[] };

export function connectedComponents(tasks: Task[]): Component[];
export function questLineProgress(
  componentId: string,
  components: Component[],
  tasks: Task[],
): { done: number; total: number };
export function rewardText(task: Task, tasks: Task[]): string;
export function detectUnlocks(prev: Task[], next: Task[]): string[];
```

`Component.id` = 정렬된 taskIds 의 첫 id (결정적).

## 3. 알고리즘

### connectedComponents
prereq 관계를 **양방향** 그래프로 보고 BFS. dangling prereq 는 무시. 결과를 task id 사전순으로 정렬.

### questLineProgress
components 에서 `id === componentId` 인 컴포넌트 찾고, 그 안 task 중 `status === 'done'` 카운트.

### rewardText
직속 후속 = `tasks.filter(t => t.prerequisites.includes(task.id))`.

| 직속 후속 개수 | 결과 |
|---|---|
| 1 | `"<후속1> 해금"` |
| 2 | `"<후속1>, <후속2> 해금"` |
| 3 | `"<후속1>, <후속2>, <후속3> 해금"` |
| 4+ | `"<N>개 작업 해금"` |
| 0, component size > 1 | `"메인 퀘스트 <done>/<total> 완료"` |
| 0, component size == 1 | `"사이드 퀘스트 완료"` |

### detectUnlocks
`isReady(task, tasksMap)` = `task.status === 'todo' && task.prerequisites.every(p => map.get(p)?.status === 'done')`.
prev 에서 ready 아니었던 + next 에서 ready 인 task id.

## 4. Tests

`lib/quest.test.ts`:

- **connectedComponents** (5): 빈 / 단일 / 선형 / 분기 / 두 독립 컴포넌트
- **questLineProgress** (3): 빈 / 절반 done / 전부 done
- **rewardText** (6): 후속 1 / 2 / 3 / 4+ / 0 with main / 0 with side
- **detectUnlocks** (4): 변화 없음 / 한 task 가 막힘→ready / 새로 추가된 ready / 이미 ready 였던 거 무시

새 baseline 43 → **61** (+18)

## 5. Out of Scope

- 카드 노드 UI → #22
- 펄스 애니메이션 자체 → #22 (감지만 여기서)
- 사이드 퀘스트 패널 UI → #23
