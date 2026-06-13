'use client';

import { useMemo } from 'react';
import { useReactFlow } from 'reactflow';
import { useAppStore } from '@/lib/store';
import { connectedComponents } from '@/lib/quest';
import { NODE_HEIGHT, NODE_WIDTH } from '@/lib/dag';
import type { Task } from '@/lib/tasks';

export function SideQuestsPanel() {
  const tasks = useAppStore((s) => s.tasks);
  const selectTask = useAppStore((s) => s.selectTask);
  const { setCenter, getNode } = useReactFlow();

  const sideTasks: Task[] = useMemo(() => {
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const comps = connectedComponents(tasks);
    return comps
      .filter((c) => c.taskIds.length === 1)
      .map((c) => taskById.get(c.taskIds[0]))
      .filter((t): t is Task => !!t);
  }, [tasks]);

  function focus(id: string) {
    const node = getNode(id);
    if (node) {
      setCenter(
        node.position.x + NODE_WIDTH / 2,
        node.position.y + NODE_HEIGHT / 2,
        { zoom: 1.2, duration: 400 },
      );
    }
    selectTask(id);
  }

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        ⚡ SIDE QUESTS ({sideTasks.length})
      </h2>
      {sideTasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
          단독 태스크가 없습니다
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {sideTasks.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => focus(t.id)}
                className={`flex w-full items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50 ${
                  t.status === 'done'
                    ? 'bg-green-50 text-slate-500 line-through'
                    : 'bg-white text-slate-700'
                }`}
              >
                <span className="text-sm">{t.icon ?? '⚡'}</span>
                <span className="truncate font-medium">{t.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
