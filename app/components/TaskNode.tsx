'use client';

import { Handle, Position } from 'reactflow';
import type { TaskNodeData } from '@/lib/dag';

const STARS_FILLED = '★';
const STARS_EMPTY = '☆';

function formatDueDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'D-day';
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

function classesForState(data: TaskNodeData, selected: boolean): string {
  const { task, isLocked } = data;
  let tone: string;
  if (task.status === 'done') {
    tone = 'bg-green-50 border-green-400 text-slate-900';
  } else if (task.status === 'in_progress') {
    tone = 'bg-blue-50 border-blue-400 text-slate-900';
  } else if (isLocked) {
    tone = 'bg-slate-50 border-slate-300 text-slate-500 opacity-60';
  } else {
    tone = 'bg-white border-slate-300 text-slate-900';
  }
  const ring = selected ? ' ring-2 ring-orange-500 ring-offset-1' : '';
  return tone + ring;
}

export function TaskNode({
  data,
  selected,
}: {
  data: TaskNodeData;
  selected?: boolean;
}) {
  const { task, isLocked, isUnlocking, reward } = data;
  const filled = 6 - task.priority;
  const stars = STARS_FILLED.repeat(filled) + STARS_EMPTY.repeat(5 - filled);
  const dueLabel = formatDueDate(task.dueDate);
  const isDone = task.status === 'done';

  return (
    <div
      className={`relative flex h-[120px] w-[200px] flex-col gap-1 rounded-lg border-2 px-3 py-2 text-xs shadow-sm transition-colors ${classesForState(
        data,
        !!selected,
      )} ${isUnlocking ? 'flowtodo-unlock' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />

      {/* 배지 */}
      {isLocked && (
        <span className="absolute left-1 top-1 rounded bg-slate-200 px-1 py-0.5 text-[9px] font-semibold text-slate-600">
          🔒 LOCKED
        </span>
      )}
      {isDone && (
        <span className="absolute right-1 top-1 rounded bg-green-200 px-1 py-0.5 text-[9px] font-semibold text-green-800">
          ✓ CLEARED
        </span>
      )}

      {/* 1행: 아이콘 + 별 */}
      <div className="flex items-center justify-between gap-1 pt-3 text-[10px]">
        <span className="text-base leading-none">{task.icon ?? '⚡'}</span>
        <span className="font-mono text-amber-500">{stars}</span>
      </div>

      {/* 2행: 제목 */}
      <div className="line-clamp-2 text-sm font-semibold leading-tight">
        {task.title}
      </div>

      {/* 3행: 메타 (마감일) */}
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {dueLabel ?? task.status.replace('_', ' ')}
      </div>

      {/* 4행: REWARD */}
      <div className="mt-auto border-t border-slate-200 pt-1 text-[10px] text-slate-600">
        <span className="text-slate-400">▷ REWARD</span>{' '}
        <span className="truncate">{reward}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400"
      />
    </div>
  );
}
