# #12 — 상태 전환 (더블클릭 순환) Design

**Status:** Approved — ready for implementation plan
**Issue:** boostcampwm-snu-2026-1/flowtodo-pkdje#12
**Depends on:** #9 ✅, #10 ✅ (Zustand store + updateTask)
**Related spec:** [04-quest-game-ui.md §5.4](../../planning/04-quest-game-ui.md)

## 1. Goal

캔버스의 task 노드를 더블클릭하면 `todo → in_progress → done → todo` 사이클로 status 가 순환한다. 노드 색이 즉시 갱신된다. 단일 클릭은 #10 의 드로어 토글 동작을 유지한다.

## 2. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | 사이클: `todo → in_progress → done → todo` | 이슈 본문 명시. 게임 UX 상 직관. |
| 2 | 단일 클릭은 setTimeout(180ms) 지연, 더블클릭 오면 취소 | React Flow 는 더블클릭 시 onNodeClick 을 먼저 1회 호출 — 가드 없으면 드로어가 열렸다 닫힘. 180ms 는 대부분의 더블클릭 임계값 안. |
| 3 | 더블클릭 중 같은 노드 인플라이트 PATCH 가드 | 노드 id 단위 `Set` 으로 중복 PATCH 방지. 빠른 더블클릭 연속 입력 시 race 방지. |
| 4 | 에러는 console 만 (토스트 없음) | 토스트 인프라는 #18 polish 에서 도입. 실패하면 색이 안 바뀌므로 자연 피드백. |
| 5 | `nextStatus` 헬퍼는 Canvas.tsx 내부에 inline | 한곳에서만 쓰이고 작아서 별도 lib 파일 YAGNI. |

## 3. Architecture

**Files touched (1 개):**
- Modify: `app/components/Canvas.tsx`

**No new files. No store changes** — `updateTask` 는 이미 #10 에서 추가됨.

## 4. Behavior

### 4.1 단일 클릭 (드로어 토글, 지연 발화)

```ts
const clickTimer = useRef<number | null>(null);

const handleNodeClick = (_, node) => {
  if (clickTimer.current !== null) return; // 이미 대기 중이면 무시
  clickTimer.current = window.setTimeout(() => {
    clickTimer.current = null;
    const current = useAppStore.getState().selectedTaskId;
    useAppStore.getState().selectTask(current === node.id ? null : node.id);
  }, 180);
};
```

### 4.2 더블클릭 (상태 순환)

```ts
const togglingRef = useRef<Set<string>>(new Set());

const handleNodeDoubleClick = async (_, node) => {
  if (clickTimer.current !== null) {
    clearTimeout(clickTimer.current);
    clickTimer.current = null;
  }
  if (togglingRef.current.has(node.id)) return;
  const task = (node.data as { task: Task })?.task;
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

function nextStatus(s: Status): Status {
  return s === 'todo' ? 'in_progress' : s === 'in_progress' ? 'done' : 'todo';
}
```

### 4.3 ReactFlow 부착

`<ReactFlow ... />` 에서 기존 `onNodeClick` prop 을 `handleNodeClick` 으로 교체하고 `onNodeDoubleClick={handleNodeDoubleClick}` 추가.

## 5. Edge Cases

- **드로어가 같은 task 로 열려있을 때 더블클릭**: `updateTask` 가 store 의 tasks 를 갱신 → 드로어 form 의 `lastTaskIdRef.current === task.id` 이므로 form 재초기화는 안 일어남. dirty 가 약간 떨릴 수 있으나 한 필드(status) 만 충돌 → 허용.
- **빠른 단일 클릭 연타 (더블클릭 아님)**: 첫 번째 클릭이 180ms timer 등록 → 두 번째 클릭은 `clickTimer.current !== null` 가드로 무시. 사용자 의도(드로어 토글)는 첫 클릭으로 이미 달성됨.
- **PATCH 실패**: 색 안 바뀜, console.error. UI 알림 없음 (#18 까지 보류).
- **빠른 더블클릭 연속 3 회**: 인플라이트 중인 PATCH 가 있는 동안은 두 번째 더블클릭 무시. PATCH 끝나면 다음 더블클릭 받음. 결과적으로 1회 또는 2회 PATCH (사용자 의도 보존).
- **빈 캔버스에서 더블클릭**: React Flow 가 노드 없는 곳 더블클릭은 콜백 안 함 → 무처리.

## 6. Testing

- **Unit**: 별도 신규 테스트 없음 (nextStatus 는 inline 헬퍼, 분리하지 않음).
- **Manual smoke (3 scenarios):**
  1. 노드 더블클릭 3 회 → 색이 흰(todo) → 파랑(in_progress) → 초록(done) → 흰 순환.
  2. 단일 클릭 → ~180ms 후 드로어 열림. 같은 노드 단일 클릭 → ~180ms 후 닫힘.
  3. 빠르게 더블클릭 → 드로어 안 열림 (timer 취소 확인), 상태만 변경.

## 7. Out of Scope

- 토스트/UI 에러 알림 → #18 polish
- 키보드 단축키 (Space 로 토글 등) → YAGNI
- 다중 선택 / 일괄 상태 변경 → YAGNI
- done 노드의 후속 task 강조 (ready 표시) → #13 추천 엔진 + #14 패널에서 자연 해결
