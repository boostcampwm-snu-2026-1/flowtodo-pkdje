# Issue #9 — 태스크 생성 모달 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Header 의 `+ 새 태스크` 버튼 클릭 → 모달 → 제목/우선순위/선행작업 입력 → POST `/api/tasks` → 그래프에 새 노드 즉시 시각화. 이 과정에서 클라이언트 상태를 **Zustand store** 로 모음 — Canvas 가 직접 fetch 하던 구조를 store 중심으로 리팩토링 (후속 #10/#11/#12/#14 도 같은 store 사용).

**Architecture:** `lib/store.ts` (Zustand) 가 `tasks` / `tasksStatus` / `createModalOpen` 상태와 `fetchTasks` / `createTask` / `openCreateModal` / `closeCreateModal` 액션을 보유. Canvas 는 useEffect 로 `fetchTasks` 한 번 호출 후 store 구독. Header 는 store 의 `openCreateModal` 만 호출. `CreateTaskModal` 은 store 의 `createModalOpen` 으로 표시/숨김, 제출 시 `createTask` 호출 → store 가 응답을 tasks 배열에 append → Canvas 자동 리렌더. 페이지 트리는 동일 (page → Header + Sidebar + Canvas + Modal), Modal 은 항상 마운트되어 있고 store state 로 visibility 제어.

**Tech Stack:** Zustand 4.x · Next.js client components · 기존 React Flow / Tailwind

**Issue:** [#9 태스크 생성 모달](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/9)
**Branch model:** `feature/9-create-modal → main` (트렁크 기반)

---

## File Structure

| File | Purpose |
|---|---|
| `lib/store.ts` | Zustand store — tasks 데이터 + 모달 상태 + 액션. 단일 store, 작아서 분리 불필요. |
| `app/components/CreateTaskModal.tsx` | 모달 컴포넌트 — backdrop + form (title / priority / prerequisites). 항상 마운트, store state 로 visibility. |
| `app/components/Header.tsx` | `'use client'` 로 전환, `+ 새 태스크` 버튼에 `openCreateModal` 연결. |
| `app/components/Canvas.tsx` | 자체 useEffect 제거, store 의 `fetchTasks` 호출 + tasks 구독. |
| `app/page.tsx` | `CreateTaskModal` 마운트 추가. |

**Not creating** (각자 후속 이슈에서):
- 노드 클릭 시 편집 드로어 (#10)
- 의존성 엣지 드래그 (#11)
- 더블클릭 상태 토글 (#12)
- 모달의 이모지 picker (#23)
- 모달 accessibility polish (Esc/focus trap, #18 또는 별도)

---

## Task 0: Feature 브랜치

- [ ] **Step 0.1: main 최신화 + 분기**

```bash
git checkout main && git pull origin main && git checkout -b feature/9-create-modal
```

Expected:
- `main` 동기화 (#8 머지 포함)
- `Switched to a new branch 'feature/9-create-modal'`

---

## Task 1: Zustand 설치

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1.1: 설치**

```bash
npm install zustand
```

Expected: `added 1 package, audited N packages in Xs`.

- [ ] **Step 1.2: 버전 확인**

```bash
node -e "console.log(require('./package.json').dependencies.zustand)"
```

Expected: `^4.x.x` 또는 `^5.x.x` 버전 문자열.

- [ ] **Step 1.3: Commit**

```bash
git add package.json package-lock.json && git commit -m "chore: add zustand for client state management (#9)"
```

---

## Task 2: `lib/store.ts` — Zustand store

**Files:**
- Create: `lib/store.ts`

- [ ] **Step 2.1: `lib/store.ts` 작성**

```ts
import { create } from 'zustand';
import type { CreateTaskInput, Task } from '@/lib/tasks';

type Status = 'idle' | 'loading' | 'ready' | 'error';

type AppState = {
  // tasks data
  tasks: Task[];
  tasksStatus: Status;
  tasksError: string | null;

  // ui — create modal
  createModalOpen: boolean;

  // actions
  fetchTasks: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  openCreateModal: () => void;
  closeCreateModal: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  tasks: [],
  tasksStatus: 'idle',
  tasksError: null,
  createModalOpen: false,

  fetchTasks: async () => {
    set({ tasksStatus: 'loading', tasksError: null });
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tasks: Task[] };
      set({ tasks: data.tasks, tasksStatus: 'ready' });
    } catch (err) {
      set({
        tasksStatus: 'error',
        tasksError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  createTask: async (input) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody.error ?? `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { task: Task };
    set((s) => ({ tasks: [...s.tasks, data.task] }));
    return data.task;
  },

  openCreateModal: () => set({ createModalOpen: true }),
  closeCreateModal: () => set({ createModalOpen: false }),
}));
```

- [ ] **Step 2.2: 타입 검사**

```bash
npm run typecheck
```

Expected: 출력 없음.

- [ ] **Step 2.3: Commit**

```bash
git add lib/store.ts && git commit -m "feat(store): add Zustand store for tasks + create modal state (#9)"
```

---

## Task 3: `Canvas` 를 store 기반으로 리팩토링

**Files:**
- Modify: `app/components/Canvas.tsx`

- [ ] **Step 3.1: `Canvas.tsx` 전체 재작성**

기존 자체 useState/useEffect fetch 패턴을 store 구독으로 교체:

```tsx
'use client';

import 'reactflow/dist/style.css';
import { useEffect, useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import { TaskNode } from './TaskNode';
import { applyLayout, buildGraph } from '@/lib/dag';
import { useAppStore } from '@/lib/store';

const nodeTypes = { task: TaskNode };

export function Canvas() {
  const tasks = useAppStore((s) => s.tasks);
  const tasksStatus = useAppStore((s) => s.tasksStatus);
  const tasksError = useAppStore((s) => s.tasksError);
  const fetchTasks = useAppStore((s) => s.fetchTasks);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const layout = useMemo(() => {
    if (tasksStatus !== 'ready') return null;
    const { nodes, edges } = buildGraph(tasks);
    return { nodes: applyLayout(nodes, edges), edges };
  }, [tasks, tasksStatus]);

  return (
    <main className="relative flex-1 overflow-hidden bg-slate-100">
      {(tasksStatus === 'idle' || tasksStatus === 'loading') && (
        <CenterMessage text="로딩 중..." />
      )}
      {tasksStatus === 'error' && (
        <CenterMessage
          text={`불러오기 실패: ${tasksError ?? 'unknown'}`}
          textClass="text-red-500"
        />
      )}
      {tasksStatus === 'ready' && tasks.length === 0 && (
        <CenterMessage text="첫 태스크를 만들어보세요 — 헤더의 + 새 태스크 클릭" />
      )}
      {tasksStatus === 'ready' && layout && tasks.length > 0 && (
        <ReactFlow
          nodes={layout.nodes}
          edges={layout.edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.08, minZoom: 0.6, maxZoom: 1.5 }}
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            style: { stroke: '#94a3b8', strokeWidth: 1.5 },
          }}
        >
          <Background gap={16} color="#cbd5e1" />
          <Controls />
          <MiniMap
            pannable
            zoomable
            nodeStrokeColor="#37474f"
            nodeStrokeWidth={1}
            maskColor="rgba(15,23,42,0.55)"
            style={{
              backgroundColor: '#fff',
              border: '2px solid #455a64',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
            }}
            nodeColor={(n) =>
              n.data?.task?.status === 'done'
                ? '#a5d6a7'
                : n.data?.task?.status === 'in_progress'
                  ? '#90caf9'
                  : '#90a4ae'
            }
          />
        </ReactFlow>
      )}
    </main>
  );
}

function CenterMessage({
  text,
  textClass = 'text-slate-400',
}: {
  text: string;
  textClass?: string;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className={`rounded-lg border border-dashed border-slate-300 bg-white px-8 py-6 text-center text-sm ${textClass}`}
      >
        {text}
      </div>
    </div>
  );
}
```

- [ ] **Step 3.2: 검증**

```bash
npm run typecheck && npm run lint && npm run format && npm run format:check && npm test
```

Expected: 모두 통과 (16/16 테스트 유지).

- [ ] **Step 3.3: Commit**

```bash
git add app/components/Canvas.tsx && git commit -m "refactor(canvas): subscribe to Zustand store instead of local fetch (#9)"
```

---

## Task 4: `Header` 를 client component 로 + 버튼 wiring

**Files:**
- Modify: `app/components/Header.tsx`

- [ ] **Step 4.1: `Header.tsx` 작성 (`'use client'` 추가, onClick wiring)**

```tsx
'use client';

import { useAppStore } from '@/lib/store';

export function Header() {
  const openCreateModal = useAppStore((s) => s.openCreateModal);
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <h1 className="text-lg font-semibold text-slate-900">flowtodo</h1>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openCreateModal}
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

- [ ] **Step 4.2: 타입 검사**

```bash
npm run typecheck
```

Expected: 출력 없음.

- [ ] **Step 4.3: Commit**

```bash
git add app/components/Header.tsx && git commit -m "feat(header): wire + 새 태스크 button to store openCreateModal (#9)"
```

---

## Task 5: `CreateTaskModal` 컴포넌트

**Files:**
- Create: `app/components/CreateTaskModal.tsx`

- [ ] **Step 5.1: `app/components/CreateTaskModal.tsx` 작성**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { Priority } from '@/lib/tasks';

const PRIORITY_OPTIONS: Priority[] = [1, 2, 3, 4, 5];

export function CreateTaskModal() {
  const open = useAppStore((s) => s.createModalOpen);
  const close = useAppStore((s) => s.closeCreateModal);
  const createTask = useAppStore((s) => s.createTask);
  const tasks = useAppStore((s) => s.tasks);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>(3);
  const [prereqIds, setPrereqIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // reset form whenever modal opens
  useEffect(() => {
    if (open) {
      setTitle('');
      setPriority(3);
      setPrereqIds([]);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  function togglePrereq(id: string) {
    setPrereqIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim() === '') {
      setError('제목은 필수입니다');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createTask({
        title: title.trim(),
        priority,
        prerequisites: prereqIds,
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40"
      onClick={close}
    >
      <div
        className="w-[480px] max-w-[90vw] rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-900">새 태스크</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="task-title"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              제목 (필수)
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
              placeholder="예: 발표 자료 만들기"
            />
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              우선순위
            </span>
            <div className="flex gap-1">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 rounded-md border px-2 py-2 text-sm transition-colors ${
                    p === priority
                      ? 'border-orange-400 bg-orange-50 text-orange-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              선행 작업 ({prereqIds.length})
            </span>
            {tasks.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400">
                기존 태스크가 없습니다 (선택 사항)
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                {tasks.map((t) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={prereqIds.includes(t.id)}
                      onChange={() => togglePrereq(t.id)}
                      className="accent-orange-500"
                    />
                    <span className="flex-1 truncate text-slate-700">
                      {t.title}
                    </span>
                    <span className="text-xs text-slate-400">{t.status}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              {submitting ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.2: 검증**

```bash
npm run typecheck && npm run lint && npm run format && npm run format:check
```

Expected: 모두 통과.

- [ ] **Step 5.3: Commit**

```bash
git add app/components/CreateTaskModal.tsx && git commit -m "feat(ui): add CreateTaskModal with title/priority/prerequisites form (#9)"
```

---

## Task 6: `page.tsx` 에 모달 마운트

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 6.1: `page.tsx` 수정**

```tsx
import { Canvas } from './components/Canvas';
import { CreateTaskModal } from './components/CreateTaskModal';
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
      <CreateTaskModal />
    </div>
  );
}
```

- [ ] **Step 6.2: 검증**

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
```

Expected: 모두 통과 (16/16).

- [ ] **Step 6.3: Commit**

```bash
git add app/page.tsx && git commit -m "feat(page): mount CreateTaskModal at app root (#9)"
```

---

## Task 7: Smoke verification (build + 인터랙티브)

- [ ] **Step 7.1: production build**

```bash
npm run build
```

Expected: `/` route 크기 살짝 증가 (Zustand + 모달 코드). build 성공.

- [ ] **Step 7.2: dev 서버 + 인터랙티브 시나리오**

```bash
npm run dev
```

브라우저 http://localhost:3000.

**시나리오 1: 빈 상태에서 첫 태스크 생성**
- [ ] 캔버스에 "첫 태스크를 만들어보세요..." 안내 표시
- [ ] 헤더 `+ 새 태스크` 클릭 → 모달 열림 (배경 어둡게)
- [ ] 제목 "기획" 입력, 우선순위 5 클릭, 선행작업 0개 (기존 태스크 없음 안내)
- [ ] `생성` 클릭 → 모달 닫힘 + 캔버스에 "기획" 노드 즉시 표시
- [ ] DevTools Network: `POST /api/tasks 201`

**시나리오 2: prereq 포함 두 번째 태스크**
- [ ] 다시 `+ 새 태스크` 클릭 → 모달 열림 (필드 초기화 확인)
- [ ] 제목 "디자인", 우선순위 4, 선행작업 = "기획" 체크
- [ ] `생성` → 모달 닫힘 + 캔버스에 "디자인" 노드 + 기획 → 디자인 엣지 표시

**시나리오 3: validation 에러**
- [ ] `+ 새 태스크` → 제목 비운 채로 `생성` → "제목은 필수입니다" 에러 메시지
- [ ] 모달 안 닫힘

**시나리오 4: 모달 닫기 동작**
- [ ] 모달 열린 상태에서 회색 배경 클릭 → 닫힘
- [ ] `+ 새 태스크` → `취소` 클릭 → 닫힘

**시나리오 5: 폼 초기화**
- [ ] 제목 일부 입력 후 `취소` → 다시 열면 빈 폼

체크 끝나면 `Ctrl+C` 로 dev 종료. (생성한 태스크는 cleanup 단계에서 자동 삭제)

- [ ] **Step 7.3: cleanup (생성한 태스크 일괄 삭제)**

```bash
# dev 서버 재기동
npm run dev > /tmp/flowtodo-dev.log 2>&1 &
DEV_PID=$!
sleep 4

# 모든 task 삭제
IDS=$(curl -s http://localhost:3000/api/tasks | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);j.tasks.forEach(t=>console.log(t.id))})")
for id in $IDS; do
  curl -s -X DELETE "http://localhost:3000/api/tasks/$id" > /dev/null
  echo "deleted $id"
done

curl -s http://localhost:3000/api/tasks   # expect {"tasks":[]}
kill $DEV_PID
```

- [ ] **Step 7.4: 최종 git 상태**

```bash
git status --short
```

Expected: 빈 출력.

---

## Task 8: Push + PR + 머지

- [ ] **Step 8.1: plan commit + push**

```bash
git add docs/superpowers/plans/2026-06-05-issue-09-create-modal.md && \
git commit -m "docs: add implementation plan for #9 create modal" && \
git push -u origin feature/9-create-modal
```

- [ ] **Step 8.2: PR 생성**

```bash
gh pr create --repo boostcampwm-snu-2026-1/flowtodo-pkdje \
  --base main --head feature/9-create-modal \
  --title "feat: task creation modal + Zustand store (#9)" \
  --body "$(cat <<'EOF'
Closes #9.

## 변경

### `lib/store.ts` — Zustand store (신규)
단일 client 스토어. tasks 데이터 + 모달 상태 + 액션.
- 상태: `tasks` / `tasksStatus` (idle/loading/ready/error) / `tasksError` / `createModalOpen`
- 액션: `fetchTasks` / `createTask` (POST 후 응답 task 를 배열에 append → Canvas 자동 리렌더) / `openCreateModal` / `closeCreateModal`
- 후속 #10/#11/#12/#14/#15/#17 가 같은 store 위에 update/delete/추천/핀 액션 확장 예정

### `app/components/CreateTaskModal.tsx` (신규)
- 항상 마운트, store 의 `createModalOpen` 으로 visibility
- 폼: 제목(필수) / 우선순위(1~5 버튼) / 선행작업(체크박스 리스트, 기존 task 가 없으면 안내)
- 제출 시 `createTask` 호출 → 성공 시 모달 닫힘, 실패 시 에러 메시지 표시
- backdrop 클릭 + 취소 버튼 둘 다 닫기
- 모달 열릴 때 폼 자동 초기화 (`useEffect`)

### `app/components/Canvas.tsx` (리팩토링)
- 자체 useState/useEffect fetch 패턴 제거
- store 의 `tasks` / `tasksStatus` 구독 + `fetchTasks` 호출
- 빈 상태 문구 변경 ("첫 태스크를 만들어보세요 — 헤더의 + 새 태스크 클릭")

### `app/components/Header.tsx`
- `'use client'` 로 전환
- `+ 새 태스크` 버튼 `onClick = openCreateModal`
- `⚙` 버튼은 여전히 액션 없음 (#17 에서 연결)

### `app/page.tsx`
- `<CreateTaskModal />` 마운트 추가

## 검증
- [x] `npm run typecheck` 통과
- [x] `npm run lint` 통과
- [x] `npm run format:check` 통과
- [x] `npm test` — 16/16 통과 (기존 lib/tasks 9 + lib/dag 7)
- [x] `npm run build` 성공
- [x] 인터랙티브 시나리오 — 빈 상태 첫 생성 / prereq 포함 둘째 생성 / 제목 비움 validation / backdrop+취소 닫기 / 폼 초기화 모두 동작

## 후속
- [#10 노드 클릭 → 편집 드로어](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/10) — store 에 `updateTask`, `deleteTask`, `selectedTaskId` 추가
- [#11 의존성 엣지 드래그 생성](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/11)
- [#12 더블클릭 상태 토글](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/12)
- [#23 모달의 이모지 picker](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/23)
EOF
)"
```

- [ ] **Step 8.3: 머지 + 정리**

```bash
gh pr merge <PR번호> --repo boostcampwm-snu-2026-1/flowtodo-pkdje --squash
# y
git checkout main && git pull origin main
```

---

## Definition of Done

1. 이슈 [#9 AC](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/9) 3개 다 충족:
   - 헤더 버튼 클릭 시 모달 열림 (Task 4 + 5) ✓
   - 제목/우선순위/선행작업 다중 입력 (Task 5) ✓
   - 제출 시 POST → 클라이언트 state 갱신 → 그래프 즉시 반영 (Task 2 + 3 + 5) ✓
2. Zustand store 도입 + Canvas 리팩토링 → 후속 인터랙션 이슈의 토대 마련.
3. typecheck / lint / format / test (16/16) / build 모두 통과.
4. PR 머지 후 main 반영.

---

## After Merge

- 이슈 #9 자동 close.
- 다음 plan: [#10 노드 클릭 → 편집 드로어](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/10) — 노드 클릭 → 우측 드로어 → 모든 필드 편집 (`updateTask` 액션 추가) + 삭제 (`deleteTask` 액션 추가).
