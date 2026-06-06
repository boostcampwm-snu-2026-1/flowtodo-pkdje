# Issue #10 — 노드 클릭 → 편집 드로어 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캔버스의 task 노드를 클릭하면 우측에 360px 패널이 열려 모든 필드(제목/상태/우선순위/마감일/설명/선행작업)를 편집하고 저장·삭제할 수 있게 한다.

**Architecture:** `lib/store.ts` 에 `selectedTaskId` 상태와 `selectTask` / `updateTask` / `deleteTask` 액션 추가. Canvas 의 `onNodeClick` 이 `selectTask` 토글. `TaskDrawer.tsx` 가 store 의 selectedTaskId 와 해당 task 를 구독해서 form 을 보여주고, 저장 시 PATCH, 삭제 시 DELETE 후 `fetchTasks()` 로 동기화. 사이클은 서버 응답(409)에 위임 — 클라이언트 reachability 계산 없음.

**Tech Stack:** Zustand · Next.js client components · 기존 React Flow / Tailwind

**Issue:** [#10 노드 클릭 → 편집 드로어](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/10)
**Spec:** [docs/superpowers/specs/2026-06-06-issue-10-edit-drawer-design.md](../specs/2026-06-06-issue-10-edit-drawer-design.md)
**Branch model:** `feature/10-edit-drawer → main` (트렁크 기반)

---

## File Structure

| File | Purpose |
|---|---|
| `lib/store.ts` | `selectedTaskId` 상태 + `selectTask` / `updateTask` / `deleteTask` 액션 추가. |
| `app/components/TaskDrawer.tsx` | 신규 — 360px 우측 패널, 6필드 폼, 저장/삭제, dirty 가드, Esc, 외부 삭제 자동 닫힘. |
| `app/components/Canvas.tsx` | `onNodeClick` 추가, 선택된 노드 강조. |
| `app/components/TaskNode.tsx` | React Flow 의 `selected` prop 받아 ring-2 ring-orange-500 추가. |
| `app/page.tsx` | `<TaskDrawer />` 마운트. |

**Not in this plan** (의도된 누락):
- 슬라이드 애니메이션 → #18 polish
- 이모지 picker (icon 필드) → #23
- 더블클릭 상태 토글 → #12
- 엣지 드래그로 prereq 추가 → #11
- 커스텀 confirm 모달 (native `confirm()` 사용)
- 키보드 단축키 (Cmd+S 등)

---

## Task 0: Feature 브랜치

- [ ] **Step 0.1: main 최신화 + 분기**

```bash
git checkout main && git pull origin main && git checkout -b feature/10-edit-drawer
```

Expected:
- `main` 동기화 (#9 + spec 커밋 포함)
- `Switched to a new branch 'feature/10-edit-drawer'`

---

## Task 1: Store 확장 — selectedTaskId / select / update / delete

**Files:**
- Modify: `lib/store.ts`

- [ ] **Step 1.1: 타입 import 보강**

[lib/store.ts:2](lib/store.ts#L2) 의 import 라인을 다음으로 교체:

```ts
import type { CreateTaskInput, Task, UpdateTaskInput } from '@/lib/tasks';
```

- [ ] **Step 1.2: AppState 에 selectedTaskId + 신규 액션 시그니처 추가**

[lib/store.ts](lib/store.ts) 의 `type AppState = { ... }` 블록 전체를 다음으로 교체:

```ts
type AppState = {
  tasks: Task[];
  tasksStatus: TasksStatus;
  tasksError: string | null;
  createModalOpen: boolean;
  selectedTaskId: string | null;

  fetchTasks: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, patch: UpdateTaskInput) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  selectTask: (id: string | null) => void;
};
```

- [ ] **Step 1.3: 초기 state 에 selectedTaskId 추가**

`useAppStore` 의 초기 객체에서 `createModalOpen: false,` 다음 줄에 추가:

```ts
  selectedTaskId: null,
```

- [ ] **Step 1.4: updateTask 액션 추가**

`createTask: async (input) => { ... },` 액션 블록 바로 아래에 다음 블록 추가:

```ts
  updateTask: async (id, patch) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    const { task }: { task: Task } = await res.json();
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? task : t)),
    }));
    return task;
  },

  deleteTask: async (id) => {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    // cascade detach 결과를 클라이언트에 반영하기 위해 다시 받아온다
    await useAppStore.getState().fetchTasks();
    set({ selectedTaskId: null });
  },
```

- [ ] **Step 1.5: selectTask 액션 추가**

`openCreateModal: () => set({ createModalOpen: true }),` 위/아래 아무 곳에 다음 한 줄 추가:

```ts
  selectTask: (id) => set({ selectedTaskId: id }),
```

- [ ] **Step 1.6: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 출력 없음 (성공).

- [ ] **Step 1.7: Commit**

```bash
git add lib/store.ts
git commit -m "feat(store): add selectedTaskId, updateTask, deleteTask, selectTask (#10)"
```

---

## Task 2: TaskNode 선택 강조

**Files:**
- Modify: `app/components/TaskNode.tsx`

- [ ] **Step 2.1: selected prop 받아 ring 추가**

[app/components/TaskNode.tsx](app/components/TaskNode.tsx) 전체를 다음으로 교체:

```tsx
'use client';

import { Handle, Position } from 'reactflow';
import type { Task } from '@/lib/tasks';

const statusClasses: Record<Task['status'], string> = {
  todo: 'bg-white border-slate-300 text-slate-900',
  in_progress: 'bg-blue-50 border-blue-400 text-slate-900',
  done: 'bg-green-50 border-green-500 text-slate-900',
};

export function TaskNode({
  data,
  selected,
}: {
  data: { task: Task };
  selected?: boolean;
}) {
  const { task } = data;
  return (
    <div
      className={`flex h-[76px] w-[150px] flex-col justify-center rounded-lg border-2 px-3 py-2 text-xs shadow-sm ${statusClasses[task.status]} ${
        selected ? 'ring-2 ring-orange-500 ring-offset-1' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <div className="line-clamp-2 font-medium leading-tight">{task.title}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
        {task.status.replace('_', ' ')}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400"
      />
    </div>
  );
}
```

- [ ] **Step 2.2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 출력 없음.

- [ ] **Step 2.3: Commit**

```bash
git add app/components/TaskNode.tsx
git commit -m "feat(TaskNode): selected ring for drawer-active node (#10)"
```

---

## Task 3: Canvas — onNodeClick 으로 selectTask 토글

**Files:**
- Modify: `app/components/Canvas.tsx`

- [ ] **Step 3.1: ReactFlow 에 onNodeClick prop 추가**

[app/components/Canvas.tsx](app/components/Canvas.tsx) 의 `<ReactFlow ...>` open 태그를 찾아서 (현재 `defaultEdgeOptions` 직전 prop 들 사이) 다음 prop 을 추가:

```tsx
onNodeClick={(_, node) => {
  const current = useAppStore.getState().selectedTaskId;
  useAppStore.getState().selectTask(current === node.id ? null : node.id);
}}
```

위치 예시 (`maxZoom={2}` 다음 줄):

```tsx
          maxZoom={2}
          onNodeClick={(_, node) => {
            const current = useAppStore.getState().selectedTaskId;
            useAppStore
              .getState()
              .selectTask(current === node.id ? null : node.id);
          }}
          defaultEdgeOptions={{
```

- [ ] **Step 3.2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 출력 없음.

- [ ] **Step 3.3: Commit**

```bash
git add app/components/Canvas.tsx
git commit -m "feat(Canvas): toggle selectedTaskId on node click (#10)"
```

---

## Task 4: TaskDrawer 컴포넌트

**Files:**
- Create: `app/components/TaskDrawer.tsx`

- [ ] **Step 4.1: 신규 파일 작성**

`app/components/TaskDrawer.tsx` 를 다음 내용으로 생성:

```tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { Priority, Status, Task, UpdateTaskInput } from '@/lib/tasks';

const PRIORITIES: Priority[] = [1, 2, 3, 4, 5];
const STATUSES: { value: Status; label: string }[] = [
  { value: 'todo', label: 'todo' },
  { value: 'in_progress', label: 'in progress' },
  { value: 'done', label: 'done' },
];

type FormState = {
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  dueDate: string; // YYYY-MM-DD, '' = 없음
  prerequisites: string[];
};

function toFormState(task: Task): FormState {
  return {
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    dueDate: toDateInput(task.dueDate),
    prerequisites: [...task.prerequisites],
  };
}

function toDateInput(iso: string | undefined): string {
  if (!iso) return '';
  // ISO → YYYY-MM-DD
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function diffPatch(original: Task, form: FormState): UpdateTaskInput {
  const patch: UpdateTaskInput = {};
  if (form.title !== original.title) patch.title = form.title.trim();
  if (form.description !== (original.description ?? '')) {
    patch.description = form.description;
  }
  if (form.status !== original.status) patch.status = form.status;
  if (form.priority !== original.priority) patch.priority = form.priority;
  const originalDate = toDateInput(original.dueDate);
  if (form.dueDate !== originalDate) {
    patch.dueDate = form.dueDate; // '' 면 서버가 undefined 로 set → 필드 제거
  }
  const originalPrereqs = [...original.prerequisites].sort().join('|');
  const formPrereqs = [...form.prerequisites].sort().join('|');
  if (originalPrereqs !== formPrereqs) {
    patch.prerequisites = form.prerequisites;
  }
  return patch;
}

export function TaskDrawer() {
  const selectedId = useAppStore((s) => s.selectedTaskId);
  const tasks = useAppStore((s) => s.tasks);
  const updateTask = useAppStore((s) => s.updateTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const selectTask = useAppStore((s) => s.selectTask);

  const task = useMemo(
    () => (selectedId ? tasks.find((t) => t.id === selectedId) : null),
    [tasks, selectedId],
  );

  // 선택된 task 가 사라지면 (외부 삭제 등) 드로어 자동 닫기
  useEffect(() => {
    if (selectedId && !task) selectTask(null);
  }, [selectedId, task, selectTask]);

  const [form, setForm] = useState<FormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTaskIdRef = useRef<string | null>(null);

  // task 가 바뀔 때마다 form 초기화
  useEffect(() => {
    if (task && task.id !== lastTaskIdRef.current) {
      setForm(toFormState(task));
      setError(null);
      setSubmitting(false);
      lastTaskIdRef.current = task.id;
    }
    if (!task) {
      lastTaskIdRef.current = null;
    }
  }, [task]);

  // Esc 키로 닫기
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tryClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // tryClose 는 form/dirty 에 의존하지만 effect 내부 closure 가 최신 form 을 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, form]);

  if (!task || !form) return null;

  const patch = diffPatch(task, form);
  const dirty = Object.keys(patch).length > 0;
  const canSave =
    dirty && form.title.trim().length > 0 && !submitting;

  function tryClose() {
    if (dirty) {
      if (!window.confirm('변경사항을 버릴까요?')) return;
    }
    selectTask(null);
  }

  function togglePrereq(id: string) {
    setForm((f) =>
      f
        ? {
            ...f,
            prerequisites: f.prerequisites.includes(id)
              ? f.prerequisites.filter((x) => x !== id)
              : [...f.prerequisites, id],
          }
        : f,
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || !task) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateTask(task.id, patch);
      selectTask(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    const ok = window.confirm(
      `"${task.title}" 을 삭제할까요? 후속 의존성은 자동 해제됩니다.`,
    );
    if (!ok) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteTask(task.id);
      // deleteTask 가 selectedTaskId 를 null 로 만들어서 자동 unmount
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  const otherTasks = tasks.filter((t) => t.id !== task.id);

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">편집</h2>
        <button
          type="button"
          onClick={tryClose}
          aria-label="닫기"
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
        >
          ✕
        </button>
      </div>

      <form
        onSubmit={handleSave}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 text-sm"
      >
        <div>
          <label
            htmlFor="drawer-title"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            id="drawer-title"
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            상태
          </label>
          <div className="flex gap-1">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setForm({ ...form, status: s.value })}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                  form.status === s.value
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            우선순위
          </label>
          <div className="flex gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setForm({ ...form, priority: p })}
                className={`flex-1 rounded-md border px-3 py-1.5 font-medium transition-colors ${
                  form.priority === p
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="drawer-due"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            마감일
          </label>
          <div className="flex gap-2">
            <input
              id="drawer-due"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            {form.dueDate && (
              <button
                type="button"
                onClick={() => setForm({ ...form, dueDate: '' })}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                ✕ 지우기
              </button>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="drawer-desc"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            설명
          </label>
          <textarea
            id="drawer-desc"
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            선행 태스크 ({form.prerequisites.length})
          </label>
          {otherTasks.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400">
              다른 태스크가 없습니다.
            </p>
          ) : (
            <ul className="max-h-40 overflow-y-auto rounded-md border border-slate-300">
              {otherTasks.map((t) => (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={form.prerequisites.includes(t.id)}
                      onChange={() => togglePrereq(t.id)}
                      className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="truncate">{t.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
      </form>

      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={submitting}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          🗑 삭제
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={tryClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={(e) => handleSave(e as unknown as React.FormEvent)}
            disabled={!canSave}
            className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4.2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 출력 없음.

- [ ] **Step 4.3: Commit**

```bash
git add app/components/TaskDrawer.tsx
git commit -m "feat(TaskDrawer): right-side edit panel with save/delete (#10)"
```

---

## Task 5: page.tsx 에 TaskDrawer 마운트

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 5.1: import + 마운트**

[app/page.tsx](app/page.tsx) 전체를 다음으로 교체:

```tsx
import { Canvas } from './components/Canvas';
import { CreateTaskModal } from './components/CreateTaskModal';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TaskDrawer } from './components/TaskDrawer';

export default function Home() {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <Canvas />
        <TaskDrawer />
      </div>
      <CreateTaskModal />
    </div>
  );
}
```

- [ ] **Step 5.2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 출력 없음.

- [ ] **Step 5.3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(page): mount TaskDrawer in layout (#10)"
```

---

## Task 6: Smoke verification

**Files:** (없음 — 검증 단계)

- [ ] **Step 6.1: Prettier 포맷**

```bash
npx prettier --write lib/store.ts app/components/TaskNode.tsx app/components/Canvas.tsx app/components/TaskDrawer.tsx app/page.tsx
```

Expected: 모든 파일 `unchanged` 또는 자동 수정.

- [ ] **Step 6.2: ESLint**

```bash
npx next lint
```

Expected: `✔ No ESLint warnings or errors`.

- [ ] **Step 6.3: Vitest**

```bash
npx vitest run
```

Expected: `Test Files 2 passed (2)`, `Tests 16 passed (16)`.

- [ ] **Step 6.4: Production build**

```bash
rm -rf .next && npx next build
```

Expected: `✓ Compiled successfully`, 4 routes (`/`, `/api/health`, `/api/tasks`, `/api/tasks/[id]`).

- [ ] **Step 6.5: Dev 서버 띄우고 브라우저 6 시나리오**

```bash
npm run dev
```

브라우저에서 http://localhost:3000 열고 **6개 시나리오** 모두 수행:

1. 노드 클릭 → 우측에 360px 드로어 등장, 클릭한 노드에 주황 ring, 폼이 task 값으로 채워짐.
2. 제목 변경 → 저장 → 드로어 닫힘 → 캔버스 노드 라벨 갱신. 다른 노드 클릭해서 다시 열어보면 새 값.
3. 상태/우선순위 변경 → 저장 → 노드 색 갱신 (in_progress → 파랑, done → 초록).
4. 마감일 입력 → 저장 → 다시 열어보면 그 날짜 그대로. ✕ 지우기 → 저장 → 다시 열면 비어있음.
5. prereq 체크 변경 → 저장 → 엣지 추가/제거 확인. **사이클 시도**: A→B 인 상태에서 A 드로어에서 B 를 prereq 로 체크 후 저장 → 빨강 에러 메시지(409 cycle), 드로어 유지.
6. 삭제 → confirm → "OK" → 노드 사라짐, 후속 노드 살아있고 prereq 가 빈 채로 유지.

모두 통과해야 다음 task. 깨지면 stop 하고 디버깅.

- [ ] **Step 6.6 (선택): dev 서버 종료**

`Ctrl+C` 로 dev 서버 종료.

---

## Task 7: Push + PR + Merge

- [ ] **Step 7.1: Push**

```bash
git push -u origin feature/10-edit-drawer
```

- [ ] **Step 7.2: PR 생성**

```bash
gh pr create --base main --head feature/10-edit-drawer --title "feat: edit drawer with save/delete (#10)" --body "$(cat <<'EOF'
Closes #10.

## Summary
- Right-side 360px **TaskDrawer**: title / status / priority / dueDate / description / prerequisites editing
- Store 확장: \`selectedTaskId\` + \`selectTask\` / \`updateTask\` / \`deleteTask\`
- Canvas \`onNodeClick\` → toggle selection; TaskNode 에 ring-2 강조
- \`window.confirm()\` 으로 dirty close 와 delete 가드 (커스텀 모달은 #18)
- 사이클은 서버 409 응답에 위임 (클라 reachability 계산 안 함)

## Test plan
- [x] \`npx next lint\` clean
- [x] \`npx vitest run\` — 16/16
- [x] \`npx next build\` — 4 routes
- [x] Browser smoke: 6 scenarios (open/edit/dueDate/prereq+cycle/delete) all pass

## Out of scope (intentional)
- Slide animation (#18 polish)
- Emoji picker on description (#23)
- Double-click status toggle (#12)
- Edge drag for prereq (#11)
EOF
)"
```

- [ ] **Step 7.3: PR 상태 확인 (사용자)**

```bash
gh pr view <PR번호> --json mergeable,mergeStateStatus
```

Expected: `MERGEABLE` + `CLEAN`.

- [ ] **Step 7.4: Squash merge + branch 삭제**

```bash
gh pr merge <PR번호> --squash --delete-branch
```

- [ ] **Step 7.5: Main 동기화**

```bash
git checkout main && git pull origin main && git log --oneline -3
```

Expected: 최신 커밋이 `feat: edit drawer with save/delete (#10) (#PR번호)`.

- [ ] **Step 7.6: 이슈 자동 close 확인**

```bash
gh issue view 10 --json state
```

Expected: `"state":"CLOSED"`.

---

## 완료 기준

- [ ] AC 4개 모두 통과 (드로어 슬라이드 인 / 6필드 편집 / PATCH 저장 / DELETE 삭제)
- [ ] PR squash 머지 + 이슈 #10 자동 close
- [ ] main 브랜치 클린 (`git status` empty)
