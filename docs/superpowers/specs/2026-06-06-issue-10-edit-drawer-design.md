# #10 — 노드 클릭 → 편집 드로어 (Design)

**Status:** Approved — ready for implementation plan
**Issue:** boostcampwm-snu-2026-1/flowtodo-pkdje#10
**Depends on:** #9 (merged — Zustand store, CreateTaskModal)
**Related spec:** [04-quest-game-ui.md §5.3, §5.4](../../planning/04-quest-game-ui.md)

## 1. Goal

캔버스의 노드를 클릭하면 우측 패널에 슬라이드되어 나오는 편집 드로어로 모든 필드를 수정하고 저장하거나 삭제할 수 있게 한다. 노드 더블클릭(#12)·엣지 드래그(#11)·이모지 picker(#23) 같은 별도 인터랙션은 이 이슈 범위 밖이다.

## 2. Architecture & Layout

### 2.1 레이아웃 변경

드로어가 열려 있을 때:

```
┌────────────────────── Header ──────────────────────┐
│  [Sidebar 320px] [Canvas flex-1] [Drawer 360px]    │
└────────────────────────────────────────────────────┘
```

- 드로어는 `w-[360px] shrink-0` 우측 고정 패널. Canvas 의 `flex-1` 이 자동으로 좁아진다.
- 닫힘은 단순 unmount (애니메이션 없음 — polish 는 #18).
- 백드롭 없음. 다른 노드 클릭 시 드로어는 그대로 두고 내용만 갈아낀다. 같은 노드 재클릭 시 닫힌다. `Esc` 키로도 닫힌다.
- 모바일/좁은 화면 포맷은 이번 범위 밖.

### 2.2 Store 확장 (`lib/store.ts`)

추가 state:

```ts
selectedTaskId: string | null;  // null = 드로어 닫힘
```

추가 actions:

```ts
selectTask: (id: string | null) => void;
updateTask: (id: string, patch: UpdateTaskInput) => Promise<Task>;
deleteTask: (id: string) => Promise<void>;
```

구현 메모:
- **selectTask** 는 `set({ selectedTaskId: id })` 만 한다. 토글(같은 id → null) 로직은 호출하는 쪽(Canvas onNodeClick)이 결정한다.
- **updateTask**: `PATCH /api/tasks/:id` → 성공 시 반환된 task 로 store 의 해당 id 교체. 실패 시 `createTask` 와 동일한 에러 패턴(body.error → throw).
- **deleteTask**: `DELETE /api/tasks/:id` → 성공 시 `fetchTasks()` 한 번 더 호출해 cascade detach 결과를 동기화. (낙관적 로컬 mutation 보다 round-trip 1회로 단순함을 선택.)

### 2.3 Canvas 변경 (`app/components/Canvas.tsx`)

```tsx
onNodeClick={(_, node) => {
  const current = useAppStore.getState().selectedTaskId;
  useAppStore.getState().selectTask(current === node.id ? null : node.id);
}}
```

선택된 노드는 `TaskNode` 안에서 `selected` (React Flow 가 자동 prop 으로 넘김) 으로 시각 강조 — `ring-2 ring-orange-500` 추가.

### 2.4 page.tsx 변경

`<CreateTaskModal />` 옆에 `<TaskDrawer />` 마운트. `TaskDrawer` 자체 내부에서 `selectedTaskId === null` 이면 `null` 을 반환.

## 3. Drawer 내부 UI (`app/components/TaskDrawer.tsx`)

```
┌──────────────────────────────────┐
│  편집                       ✕   │
├──────────────────────────────────┤
│  제목 *  [_______________]       │
│  상태    [todo][in_progress][done]│
│  우선순위 [1][2][3][4][5]        │
│  마감일  [📅 YYYY-MM-DD ][✕]     │
│  설명    ┌────────────┐          │
│         │ (4줄)      │          │
│         └────────────┘          │
│  선행 태스크 (N)                 │
│         ┌────────────┐          │
│         │ ☐ A        │          │
│         │ ☑ B        │          │
│         └────────────┘          │
│  [에러 영역 conditional]         │
├──────────────────────────────────┤
│  🗑 삭제      [취소] [저장]      │
└──────────────────────────────────┘
```

### 3.1 폼 초기화 & dirty

- `selectedTaskId` 가 바뀔 때마다 `useEffect` 안에서 store 의 해당 task 로 form state 를 초기화한다.
- 원본 task 와 현재 form 값을 비교해서 dirty 여부 계산. "저장" 은 `dirty && titleNonEmpty && !submitting` 일 때 활성.
- dirty 상태에서 ✕ / Esc / 취소 시 `confirm('변경사항을 버릴까요?')` 로 확인한다.

### 3.2 저장

- "저장" 클릭 → `updateTask(id, patch)` 호출.
  - patch 는 **변경된 필드만**.
  - `dueDate`:
    - 변경 없음 → patch 에 키 미포함.
    - 사용자가 ✕ 로 지웠음 → patch 에 `dueDate: ''` 포함. 서버 `updateTask` 는 `input.dueDate ? new Date(...) : undefined` 로 처리하므로 사실상 필드 제거 효과 ([lib/tasks.ts:195-197](../../../lib/tasks.ts#L195-L197) 확인됨).
    - 새 날짜 → patch 에 `dueDate: 'YYYY-MM-DD'` 포함. 서버가 `new Date(...)` 로 파싱.
- 성공: 드로어 닫고 (`selectTask(null)`) store 갱신.
- 실패: 드로어 유지, 에러 영역에 메시지.

### 3.3 삭제

- `🗑 삭제` 클릭 → `window.confirm("\"{title}\" 을 삭제할까요? 후속 의존성은 자동 해제됩니다.")` → OK 시 `deleteTask(id)`.
- 성공 시 드로어 자동으로 닫힘 (selectedTaskId 가 가리키는 task 가 사라져서 가드가 닫음, 또는 명시적으로 `selectTask(null)`).

### 3.4 선행 태스크 목록

- store 의 `tasks` 에서 **자기 자신만** 제외하고 전부 표시. 간접 사이클 가드는 서버 응답에 위임 (이번 결정 — A2).
- 체크박스 토글로 prereq 배열 편집.

## 4. 에러 처리 매트릭스

| 시나리오 | API 응답 | 드로어 동작 |
|---------|---------|-----------|
| 제목 빈칸 | (제출 자체 차단) | 저장 버튼 disabled |
| 우선순위 범위 외 | 400 TaskValidationError | 에러 메시지, 드로어 유지 |
| 간접 사이클 | 409 TaskCycleError | 빨강 에러 메시지, 드로어 유지 |
| 자기 자신 prereq | (체크박스 자체 없음) | UI 가드로 차단 |
| 존재하지 않는 prereq id | 400 TaskValidationError | 에러 메시지 |
| 삭제 중 이미 삭제됨 | 404 TaskNotFoundError | 드로어 닫고 fetchTasks 로 동기화 |
| 네트워크 실패 | fetch reject | "네트워크 오류" 메시지, 드로어 유지 |

## 5. 엣지케이스

- **선택된 task 가 외부 경로로 사라짐**: `selectedTaskId` 가 store 의 tasks 에 없으면 `TaskDrawer` 가 자동으로 `selectTask(null)` 호출.
- **드로어 열린 상태에서 새 태스크 모달 열기**: 허용 (드로어는 우측, 모달은 중앙 오버레이 — 시각 충돌 없음).
- **dueDate 변환**: 서버는 ISO 문자열, `<input type="date">` 는 `YYYY-MM-DD`. 드로어 내부에 헬퍼 `toDateInput(iso): string`, `fromDateInput(s): string | undefined` 둠.
- **빈 문자열 dueDate**: §3.2 에서 결정 — patch 에 `dueDate: ''` 로 포함. 서버가 `$set: { dueDate: undefined }` 로 처리.

## 6. 테스트

- **단위 테스트**: 새로 만들 순수 lib 함수가 없으므로 신규 vitest 케이스 없음. 기존 `lib/tasks.test.ts`, `lib/dag.test.ts` 통과 유지 확인.
- **수동 smoke 시나리오 6개**:
  1. 노드 클릭 → 드로어 우측 슬라이드 → 폼이 해당 task 값으로 채워짐.
  2. 제목/우선순위/상태 변경 → "저장" → 드로어 닫힘 → 캔버스 노드 라벨/색 갱신.
  3. 마감일 추가/제거 → 저장 → 다시 열어서 값 확인.
  4. prereq 체크 변경 → 저장 → 엣지 추가/제거 확인.
  5. 사이클 만들기 (A→B 인 상태에서 A 드로어에서 B 를 prereq 추가) → 409 에러 노출, 드로어 유지.
  6. 삭제 → confirm → 노드 사라짐, 후속 노드 살아있고 prereq 가 비워짐.

## 7. 스코프 경계 — #10 에서 하지 않을 것

- 이모지 picker (→ #23)
- 더블클릭 상태 토글 (→ #12)
- 엣지 드래그 (→ #11)
- 드로어 슬라이드 애니메이션 polish (→ #18)
- 변경사항 자동저장/dirty 인디케이터 토스트 (→ YAGNI)
- 키보드 단축키 (Cmd+S 등) (→ YAGNI)

## 8. Files

- Create: `app/components/TaskDrawer.tsx` (~240줄 예상)
- Modify: `lib/store.ts` (+selectedTaskId, +selectTask, +updateTask, +deleteTask)
- Modify: `app/components/Canvas.tsx` (+onNodeClick)
- Modify: `app/components/TaskNode.tsx` (+selected 강조)
- Modify: `app/page.tsx` (+`<TaskDrawer />`)

## 9. Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | 명시적 저장 버튼 (자동저장 X) | 모달과 동일 멘탈모델, 검증 단순, dirty 추적 쉬움 |
| 2 | 사이클은 서버 응답에 위임 | server-of-truth 일관, 클라 reachability 계산 안 함 |
| 3 | 삭제는 `window.confirm()` | 5분 구현, 커스텀 모달은 #18 polish |
| 4 | 이모지 picker 제외 | #23 와 같이 하면 모달/드로어 둘 다 한번에 처리 가능 |
| 5 | 우측 고정 패널 (Canvas 밀기) | 편집 중 그래프 동시 시야, overlay 보다 단순 |
| 6 | deleteTask 후 fetchTasks refetch | 로컬 mutation 보다 1회 round-trip 이 단순 |
