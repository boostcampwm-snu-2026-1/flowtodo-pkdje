'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { Priority } from '@/lib/tasks';

const PRIORITIES: Priority[] = [1, 2, 3, 4, 5];

export function CreateTaskModal() {
  const open = useAppStore((s) => s.createModalOpen);
  const close = useAppStore((s) => s.closeCreateModal);
  const tasks = useAppStore((s) => s.tasks);
  const createTask = useAppStore((s) => s.createTask);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>(3);
  const [dueDate, setDueDate] = useState(''); // YYYY-MM-DD, '' = 없음
  const [prereqs, setPrereqs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form whenever modal opens
  useEffect(() => {
    if (open) {
      setTitle('');
      setPriority(3);
      setDueDate('');
      setPrereqs([]);
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const trimmedTitle = title.trim();
  const canSubmit = trimmedTitle.length > 0 && !submitting;

  const togglePrereq = (id: string) => {
    setPrereqs((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createTask({
        title: trimmedTitle,
        priority,
        prerequisites: prereqs,
        ...(dueDate ? { dueDate } : {}),
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">새 태스크</h2>
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="task-title"
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 로그인 API 구현"
              autoFocus
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
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
                  onClick={() => setPriority(p)}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    priority === p
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
              htmlFor="task-due"
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              마감일
            </label>
            <div className="flex gap-2">
              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate('')}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  ✕ 지우기
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              선행 태스크 ({prereqs.length})
            </label>
            {tasks.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400">
                아직 다른 태스크가 없습니다.
              </p>
            ) : (
              <ul className="max-h-40 overflow-y-auto rounded-md border border-slate-300">
                {tasks.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={prereqs.includes(t.id)}
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

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
