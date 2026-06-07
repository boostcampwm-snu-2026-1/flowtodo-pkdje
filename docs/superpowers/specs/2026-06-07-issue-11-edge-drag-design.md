# #11 — 의존성 엣지 생성/삭제 + 사이클 방지 Design

**Status:** Approved — ready for implementation plan
**Issue:** boostcampwm-snu-2026-1/flowtodo-pkdje#11
**Depends on:** #8 ✅ (DAG 렌더), #10 ✅ (store.updateTask), #13 ✅ (detectCycle)

## 1. Goal

Canvas 에서:
- 노드 핸들에서 다른 노드로 드래그 → 의존성 엣지(prerequisite) 생성. 사이클이 생기는 시도는 드래그 중부터 빨강 점선으로 표시 + drop 거부.
- 엣지 클릭 → confirm → prerequisite 제거.

모든 변경은 `store.updateTask(target, { prerequisites })` 한 줄로 귀결. `Task.prerequisites` 가 진실 원천.

## 2. Architecture

### 2.1 데이터 흐름

```
사용자 인터랙션 (Canvas)
    │
    ▼ isValidConnection (드래그 중 사이클 가드)
    │
    ▼ onConnect (drop)
wouldCreateCycle(tasks, source, target)  ← 한 번 더 가드
    │
    ▼ (사이클 아니면)
store.updateTask(target, { prerequisites: [...target.prereq, source] })
    │
    ▼ (서버 200)
store.tasks 갱신 → Canvas 자동 재렌더 → 엣지 자연스럽게 등장
```

엣지 삭제는 대칭:
```
onEdgeClick → window.confirm → store.updateTask(target, { prerequisites: 제거 })
```

### 2.2 엣지 = prerequisites 의 시각화

| 인터랙션 | source | target | 의미 |
|---|---|---|---|
| 드래그 (위→아래) | prereq (위쪽 노드) | dependent (아래쪽 노드) | "dependent.prereq 에 source 추가" |
| 엣지 클릭 | 위쪽 노드 | 아래쪽 노드 | "dependent.prereq 에서 source 제거" |

`lib/dag.ts` 의 buildGraph 가 prereq → dependent 방향으로 엣지를 만들기 때문에 의미가 시각과 일치.

### 2.3 파일

| File | 역할 |
|---|---|
| `lib/recommender.ts` | `wouldCreateCycle(tasks, source, target): boolean` 신규 export. 내부적으로 기존 `detectCycle` 에 가상 엣지 추가한 사본 전달. |
| `lib/recommender.test.ts` | `wouldCreateCycle` 4 케이스 추가. 새 baseline 43 (= 39 + 4). |
| `app/components/Canvas.tsx` | `onConnect`, `isValidConnection`, `onEdgeClick` 콜백 추가. 사이클 거부 시 1.6초 우상단 토스트. `deleteKeyCode={null}` 로 Backspace 키 비활성. |

`lib/dag.ts` 의 buildGraph 는 그대로 — 엣지가 새로 생기면 자동으로 다음 렌더에 등장.

## 3. `wouldCreateCycle` 함수

### 3.1 시그니처

```ts
export function wouldCreateCycle(
  tasks: Task[],
  source: string,
  target: string,
): boolean;
```

### 3.2 구현

```ts
export function wouldCreateCycle(
  tasks: Task[],
  source: string,
  target: string,
): boolean {
  if (source === target) return true;

  const targetTask = tasks.find((t) => t.id === target);
  if (!targetTask) return false;
  if (targetTask.prerequisites.includes(source)) return false;
  if (!tasks.some((t) => t.id === source)) return false;

  const candidate = tasks.map((t) =>
    t.id === target
      ? { ...t, prerequisites: [...t.prerequisites, source] }
      : t,
  );
  return detectCycle(candidate);
}
```

### 3.3 빠른 경로 3가지

1. `source === target` → 즉시 true
2. 이미 존재하는 엣지 → false (의미 없는 시도, 안전 차단)
3. source 가 tasks 에 없음 → false (dangling, 사이클 발생 불가)

기본 경로는 사본 + `detectCycle`. O(V+E).

### 3.4 캡슐화

`detectCycle` 은 내부 비-export 유지. UI 가 직접 부를 일 없고, 사이클 가드는 `wouldCreateCycle` 한 엔드포인트로 통일.

## 4. Canvas UI 통합

### 4.1 새 상태

```ts
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

### 4.2 콜백 3개

```ts
const isValidConnection = (conn: Connection) => {
  const tasks = useAppStore.getState().tasks;
  if (!conn.source || !conn.target) return false;
  return !wouldCreateCycle(tasks, conn.source, conn.target);
};

const onConnect = async (conn: Connection) => {
  if (!conn.source || !conn.target) return;
  const tasks = useAppStore.getState().tasks;
  if (wouldCreateCycle(tasks, conn.source, conn.target)) {
    showError('순환 의존성이 생겨 거부됨');
    return;
  }
  const target = tasks.find((t) => t.id === conn.target);
  if (!target) return;
  if (target.prerequisites.includes(conn.source)) return;
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
  const tasks = useAppStore.getState().tasks;
  const target = tasks.find((t) => t.id === edge.target);
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

### 4.3 ReactFlow 부착

```tsx
<ReactFlow
  ...기존
  onConnect={onConnect}
  onEdgeClick={onEdgeClick}
  isValidConnection={isValidConnection}
  deleteKeyCode={null}
  connectionLineType="smoothstep"
  connectionLineStyle={{ stroke: '#94a3b8', strokeWidth: 1.5 }}
  ...
/>
```

React Flow 가 자동으로:
- 드래그 중 hover 노드가 invalid 면 빨강 점선 (`react-flow__connection-path` 에 default style 적용)
- drop 해도 onConnect 안 호출

### 4.4 에러 알림 UI

Canvas 의 `<main>` 우측 상단 absolute 토스트:

```tsx
{edgeError && (
  <div className="absolute right-4 top-4 z-10 rounded-md bg-red-500 px-3 py-2 text-xs font-medium text-white shadow-lg">
    {edgeError}
  </div>
)}
```

1.6초 후 setEdgeError(null) 으로 자동 사라짐.

### 4.5 키보드 비활성

`deleteKeyCode={null}` 명시. React Flow 기본은 `'Backspace'` 라 confirm 거치지 않고 즉시 삭제 → 위험. confirm 모달 도입(#18) 까지 비활성.

## 5. 인터랙션 매트릭스

| 사용자 행동 | 결과 |
|---|---|
| 핸들에서 다른 노드로 드래그 (유효) | 드래그 라인 회색 → drop → onConnect → PATCH → 엣지 등장 |
| 자기 자신/사이클 드래그 | 드래그 라인 빨강 점선 → drop 해도 변화 없음 |
| 사이클 시도 + drop (드물게 우회) | onConnect 재가드 → 토스트 1.6초 |
| 이미 존재하는 엣지 다시 드래그 | drop 해도 store 변화 없음 (중복 차단) |
| 엣지 클릭 | confirm → PATCH 로 제거 → 엣지 사라짐 |
| Backspace 키 | 무시 (deleteKeyCode=null) |

## 6. Testing

### 6.1 단위 테스트 — `wouldCreateCycle` 4 케이스

```ts
describe('wouldCreateCycle', () => {
  it('self-loop A→A is a cycle', () => {
    expect(wouldCreateCycle([mkTask('a')], 'a', 'a')).toBe(true);
  });

  it('A→B in independent graph is not a cycle', () => {
    expect(wouldCreateCycle([mkTask('a'), mkTask('b')], 'a', 'b')).toBe(false);
  });

  it('A→B when A.prereq already includes B → would create cycle', () => {
    const tasks = [mkTask('a', ['b']), mkTask('b')];
    expect(wouldCreateCycle(tasks, 'a', 'b')).toBe(true);
  });

  it('indirect cycle: A→B→C chain, adding C→A creates cycle', () => {
    const tasks = [mkTask('a'), mkTask('b', ['a']), mkTask('c', ['b'])];
    expect(wouldCreateCycle(tasks, 'c', 'a')).toBe(true);
  });
});
```

새 baseline 43 (= 39 + 4).

### 6.2 수동 smoke (8 시나리오)

1. 엣지 생성 — 정상: A → B 드래그 → 엣지 등장.
2. 사이클 차단 직접: A→B 인 상태에서 B→A 드래그 → 빨강 점선 + drop 거부.
3. 사이클 차단 간접: A→B→C 인 상태에서 C→A 드래그 → 빨강 + drop 거부.
4. 자기 자신: A→A 드래그 → 빨강.
5. 중복 엣지: 이미 A→B 인 상태에서 A→B 다시 → drop 시 store 변화 없음.
6. 엣지 삭제 — 정상: 엣지 클릭 → confirm OK → 엣지 사라짐.
7. 엣지 삭제 — 취소: confirm 취소 → 변화 없음.
8. 에러 토스트: 사이클 시도가 onConnect 까지 도달 → 우상단 빨강 토스트 1.6초.

## 7. Edge Cases

| 케이스 | 처리 |
|---|---|
| Connection.source/target null | isValidConnection false |
| target 이 store 에 없음 (race) | onConnect 조용히 return |
| 중복 엣지 | onConnect 조용히 return (토스트 없음) |
| PATCH 실패 (네트워크/409) | showError 로 메시지 |
| 드래그 중 노드 삭제 (드물) | React Flow 가 connection 무효화 |
| 엣지가 stale (다른 클라이언트가 삭제) | onEdgeClick 후 PATCH 가 prereq 못 찾아 noop |

## 8. Out of Scope

- 키보드 (Backspace) 로 엣지 삭제 → deleteKeyCode={null} 로 의도적 비활성. 커스텀 confirm 모달은 #18.
- 토스트 인프라 도입 → #18
- 다중 엣지 선택/삭제 → YAGNI
- 엣지 라벨/타입 변경 → YAGNI
- 엣지 hover 시 강조 / hand cursor → 가능하면 1줄로 처리 가능 (Tailwind 의 cursor-pointer). spec 4.4 의 토스트 외 추가 polish 는 #18.

## 9. Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | `wouldCreateCycle` 신규 export, `detectCycle` 비공개 유지 | 사이클 가드 진입점 단일화. UI 코드 간결. |
| 2 | isValidConnection + onConnect 양쪽 가드 | UX 즉시성 + drop 시 방어. |
| 3 | 사이클 거부 = 우상단 1.6초 토스트 | 토스트 인프라 #18 까지 기다리지 않고 자체 완결 inline 알림. |
| 4 | `deleteKeyCode={null}` | confirm 우회 위험 차단. 커스텀 모달은 #18. |
| 5 | 엣지 클릭 = `window.confirm` | `#10` / `#9` 와 동일한 패턴. |
| 6 | 중복 엣지 = silent noop | 사용자 의도 없는 중복은 토스트로 시끄럽게 알릴 가치 없음. |
| 7 | 모든 변경은 store.updateTask 로 귀결 | DRY. 서버 검증/cascade detach 도 그대로 활용. |
