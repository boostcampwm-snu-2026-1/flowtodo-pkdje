'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { connectedComponents, questLineProgress } from '@/lib/quest';

export function ProgressPanel() {
  const tasks = useAppStore((s) => s.tasks);

  const { main, side } = useMemo(() => {
    const comps = connectedComponents(tasks);
    let mainDone = 0;
    let mainTotal = 0;
    let sideDone = 0;
    let sideTotal = 0;
    for (const c of comps) {
      const p = questLineProgress(c.id, comps, tasks);
      if (c.taskIds.length >= 2) {
        mainDone += p.done;
        mainTotal += p.total;
      } else {
        sideDone += p.done;
        sideTotal += p.total;
      }
    }
    return {
      main: { done: mainDone, total: mainTotal },
      side: { done: sideDone, total: sideTotal },
    };
  }, [tasks]);

  return (
    <section className="mb-2">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        진행 현황
      </h2>
      <div className="space-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
        <ProgressLine label="메인 퀘스트" done={main.done} total={main.total} />
        <ProgressLine label="사이드" done={side.done} total={side.total} />
      </div>
    </section>
  );
}

function ProgressLine({
  label,
  done,
  total,
}: {
  label: string;
  done: number;
  total: number;
}) {
  const ratio = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-600">{label}</span>
      <span className="font-mono text-slate-800">
        {done}/{total}
        {total > 0 ? (
          <span className="ml-1 text-slate-400">({ratio}%)</span>
        ) : null}
      </span>
    </div>
  );
}
