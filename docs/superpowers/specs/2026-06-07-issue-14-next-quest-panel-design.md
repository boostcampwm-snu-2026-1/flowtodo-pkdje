# #14 — 추천 패널 UI (NEXT QUEST) Design

**Status:** Approved — ready for implementation plan
**Issue:** boostcampwm-snu-2026-1/flowtodo-pkdje#14
**Depends on:** #8 ✅ (DAG 렌더), #13 ✅ (추천 엔진)
**Related planning:** [01-project-plan.md §5](../../planning/01-project-plan.md), [04-quest-game-ui.md §5.2](../../planning/04-quest-game-ui.md)

## 1. Goal

Sidebar 의 `▶ NEXT QUEST` placeholder 자리에 추천 엔진 결과 **Top 3** 를 카드로 표시. 카드 클릭 시 React Flow 캔버스의 카메라가 해당 노드로 이동하고 편집 드로어가 열린다. tasks state 가 바뀔 때마다 자동 재계산.

## 2. Architecture

### 2.1 데이터 흐름

```
store.tasks (변경 감지)
    │
    ▼ useMemo([tasks])
computeRecommendations(tasks) → Recommendation[]
    │
    ▼ slice(0, 3)
NextQuestPanel ─→ Top 3 카드
    │
    ▼ click(taskId)
useReactFlow().setCenter(x, y, { zoom: 1.2, duration: 400 })
+ store.selectTask(taskId)  // #10 의 ring 강조 + 드로어 열림 재사용
```

### 2.2 카메라 이동 — ReactFlowProvider 전략

NextQuestPanel 은 Canvas 와 별개 컴포넌트라 `useReactFlow` 훅을 그대로 못 씀. **`<ReactFlowProvider>` 로 page 전체를 감싸서** Sidebar / Canvas / Drawer 가 같은 인스턴스 공유:

```tsx
// app/page.tsx
import { ReactFlowProvider } from 'reactflow';

export default function Home() {
  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <Canvas />
          <TaskDrawer />
        </div>
        <CreateTaskModal />
      </div>
    </ReactFlowProvider>
  );
}
```

`page.tsx` 가 client component 화되지만 자식이 모두 `'use client'` 라 SSR 비용 손실 없음.

### 2.3 파일

| File | 역할 |
|---|---|
| `app/components/Sidebar.tsx` | NEXT QUEST placeholder 제거 → `<NextQuestPanel />` 마운트. SIDE QUESTS / 진행 현황 placeholder 는 그대로 (#23). |
| `app/components/NextQuestPanel.tsx` | 신규. store 구독 → recommendations 계산 → Top 3 표시 + 클릭 핸들러. ~130줄. `NextQuestPanel` + `QuestCard` 두 컴포넌트가 한 파일에. |
| `app/page.tsx` | `<ReactFlowProvider>` 로 감쌈. `'use client'` 디렉티브 추가. |
| `lib/recommender.ts` | `Recommendation.unlocks: string[]` 필드 추가. `computeImpactSet` 신규 export. `computeImpact` 는 내부에서 `computeImpactSet` 호출 → DRY. |
| `lib/recommender.test.ts` | `computeImpactSet` 2 케이스 추가. `computeRecommendations` end-to-end 케이스에 `recs[0].unlocks` 검증 한 줄 추가. |

## 3. `lib/recommender.ts` 확장

### 3.1 타입 변경

```ts
export type Recommendation = {
  task: Task;
  ready: true;
  impact: number;
  score: number;
  breakdown: {
    priorityComponent: number;
    impactComponent: number;
  };
  unlocks: string[];  // ← 신규: 이 task 의 직간접 다운스트림 (status !== 'done') task id 들
};
```

`unlocks.length === impact` 항상 성립.

### 3.2 새 함수 + 기존 함수 재구성

```ts
// 신규 — 내부 Set 노출
export function computeImpactSet(tasks: Task[]): Map<string, Set<string>>;

// 기존 — 호환 유지, 내부에서 computeImpactSet 호출 후 .size 매핑
export function computeImpact(tasks: Task[]): Map<string, number>;
```

`computeRecommendations` 는 `computeImpactSet` 을 호출해서 `unlocks: Array.from(impactSet.get(id) ?? [])` 를 채워 넣는다. `maxImpact` 계산은 `set.size` 의 최대값.

### 3.3 신규 테스트 (2 개)

```ts
describe('computeImpactSet', () => {
  it('returns same size as computeImpact', () => {
    const tasks = [
      mkTask('a'), mkTask('b', ['a']), mkTask('c', ['b']),
    ];
    const sets = computeImpactSet(tasks);
    const nums = computeImpact(tasks);
    for (const [id, set] of sets) {
      expect(set.size).toBe(nums.get(id));
    }
  });

  it('exposes downstream ids (linear A→B→C → A.unlocks={B,C})', () => {
    const tasks = [
      mkTask('a'), mkTask('b', ['a']), mkTask('c', ['b']),
    ];
    const sets = computeImpactSet(tasks);
    expect(Array.from(sets.get('a')!).sort()).toEqual(['b', 'c']);
    expect(Array.from(sets.get('b')!)).toEqual(['c']);
  });
});
```

추가로 `computeRecommendations` 의 end-to-end 케이스 (다이아몬드 + done) 에 한 줄 검증 추가:

```ts
expect(recs[0].unlocks).toEqual(['d']);  // C 의 unlocks = D
```

## 4. NextQuestPanel UI

### 4.1 단일 카드 시각

```
┌──────────────────────────────────┐
│ ⚡ 로그인 API 구현               │
│ ★★★★☆                            │  ← priority 4
│ score 0.62                        │
│ ▷ 회원가입, 마이페이지 해금       │  ← unlocks 1~2개, 없으면 라인 생략
└──────────────────────────────────┘
```

- **이모지**: 항상 ⚡ 고정 (icon 필드는 #23). 카드 디자인 일관성 차원.
- **별**: priority 1~5 → `'★'.repeat(p) + '☆'.repeat(5-p)`.
- **score**: `score.toFixed(2)` (소수점 2자리).
- **unlocks 미리보기**: store.tasks 에서 unlocks id 를 title 로 매핑, 최대 2개만 `'A, B 해금'` 형식. 3개 이상이면 `'A, B 외 N개 해금'`. 0개면 라인 자체 생략.

### 4.2 패널 전체

```
▶ NEXT QUEST (3)

[card 1]   ← 1등: border-orange-500 bg-orange-50 강조
[card 2]
[card 3]
```

상태별:
- 빈 ready: placeholder `"아직 시작 가능한 작업이 없어요"`
- `tasksStatus === 'loading'`: placeholder `"로딩 중..."`
- `tasksStatus === 'error'`: placeholder `"추천을 표시할 수 없습니다"` (회색)
- `RecommenderCycleError` catch: 빨강 메시지 `"그래프에 사이클이 있습니다. 편집기에서 의존성을 확인해 주세요."`

### 4.3 클릭 동작

```ts
const { setCenter, getNode } = useReactFlow();
const selectTask = useAppStore((s) => s.selectTask);

const NODE_WIDTH = 150;
const NODE_HEIGHT = 76;

function onCardClick(taskId: string) {
  const node = getNode(taskId);
  if (node) {
    setCenter(
      node.position.x + NODE_WIDTH / 2,
      node.position.y + NODE_HEIGHT / 2,
      { zoom: 1.2, duration: 400 },
    );
  }
  selectTask(taskId);  // ring + 드로어 열림
}
```

상수 `NODE_WIDTH / NODE_HEIGHT` 는 `lib/dag.ts` 와 동일. NextQuestPanel 안 inline 으로 두고, 만약 #22 가 카드 크기를 바꾸면 그때 공통 상수 분리.

### 4.4 컴포넌트 구성

`NextQuestPanel.tsx` 한 파일에:
- `NextQuestPanel` — store/recommender/useReactFlow 구독, 상태 분기, map.
- `QuestCard` — 단일 카드 표시. props: `recommendation`, `isLeader`, `unlocksLabel`, `onClick`.

별도 파일까지는 YAGNI.

## 5. Sidebar 변경

`app/components/Sidebar.tsx` 의 NEXT QUEST `<Section />` 만 `<NextQuestPanel />` 로 교체. 나머지 두 `<Section />` (SIDE QUESTS, 진행 현황) 은 그대로 placeholder 유지 (#23 의 몫).

## 6. Edge Cases

| 케이스 | 처리 |
|---|---|
| 빈 ready | placeholder "아직 시작 가능한 작업이 없어요" |
| 로딩 / 에러 | placeholder |
| 사이클 입력 | `try/catch (RecommenderCycleError)` 안에서 빨강 메시지 |
| 카드 클릭 시 노드가 화면 밖 | setCenter 가 카메라 이동 처리 |
| 이미 드로어 열린 채 카드 클릭 | selectTask(id) → 드로어 form 재초기화 (#10 의 lastTaskIdRef) |
| unlocks 가 0개 | "▷ 해금" 라인 자체 생략 |
| unlocks 가 3개 이상 | "A, B 외 N개 해금" |

## 7. Performance

- `computeRecommendations` 는 O(V+E) — 수백 task 까지 즉시.
- `useMemo([tasks])` 가 캐싱. store 의 fetch/create/update/delete 가 새 배열을 만들므로 자연스러운 트리거.
- 카드 자체는 React.memo 없이 단순 렌더 (Top 3 = 3개 항목, 비용 무시).

## 8. Testing

- **단위**: §3.3 의 2 케이스 + 기존 케이스에 한 줄 추가 → 22 케이스. 기존 dag + tasks + recommender = 38 case 새 baseline.
- **수동 smoke (6 시나리오):**
  1. 빈 캔버스 → 패널 placeholder 표시.
  2. 단일 ready 추가 → 카드 1개, 1등 강조, ▷ 라인 없음, 클릭 → 카메라 줌 + 드로어 열림.
  3. ready 4개 이상 → Top 3 만, 정렬 정확.
  4. 체인 A→B→C, A done → ready=B → 카드에 "▷ C 해금". B done 토글(더블클릭) → 패널 즉시 갱신, C 가 1등.
  5. (안전망) 사이클 입력 → 빨강 메시지.
  6. 1등만 주황 강조, 2-3등은 기본 톤.

## 9. Out of Scope

#14 가 **안 함**:
- 핀 / Snooze → **#15**
- 가중치 슬라이더 → **#17**
- SIDE QUESTS 섹션 → **#23**
- 진행 현황 박스 → **#23**
- 이모지 picker → **#23**
- 퀘스트 카드 노드 (DAG 노드 시각 리뉴얼) → **#22**
- 새 unlock 펄스 애니메이션 → **#22**

## 10. Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Top 3 만 표시 | spec 04 기준. 집중 유도. 나머지는 그래프에서. |
| 2 | unlocks 미리보기 포함 | "왜 이게 1등인지" 즉시 설명. computeImpact 가 이미 Set 보유 → 5분 변경. |
| 3 | ReactFlowProvider 로 page 감싸기 | 정식 패턴. 후속 #11/#22 도 같은 인스턴스 사용 가능. |
| 4 | 카드 클릭 = setCenter + selectTask | #10 의 드로어 강조 인프라 그대로 재사용. |
| 5 | computeImpactSet 신규 export, computeImpact 는 호환 유지 | DRY. UI 가 Set 을 직접 받음. |
| 6 | NextQuestPanel + QuestCard 한 파일 | 다른 곳에서 재사용 안 함. YAGNI. |
| 7 | 이모지 ⚡ 고정 | #23 의 icon 필드 도입 전까지 일관 톤. |
