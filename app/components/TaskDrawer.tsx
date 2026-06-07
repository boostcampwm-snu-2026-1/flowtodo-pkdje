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

function toDateInput(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

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
    () =>
      selectedId ? (tasks.find((t) => t.id === selectedId) ?? null) : null,
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

  const patch = task && form ? diffPatch(task, form) : {};
  const dirty = Object.keys(patch).length > 0;
  const canSave =
    !!form && dirty && form.title.trim().length > 0 && !submitting;

  function tryClose() {
    if (dirty) {
      if (!window.confirm('변경사항을 버릴까요?')) return;
    }
    selectTask(null);
  }

  // Esc 키로 닫기
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tryClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // tryClose 가 form/dirty 에 의존하지만 effect 내부 closure 가 최신 값을 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, form]);

  if (!task || !form) return null;

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
            우선순위 <span className="text-slate-400">(1 = 가장 높음)</span>
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
