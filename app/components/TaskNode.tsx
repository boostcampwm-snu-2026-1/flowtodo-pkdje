'use client';

import { Handle, Position } from 'reactflow';
import type { Task } from '@/lib/tasks';

const statusClasses: Record<Task['status'], string> = {
  todo: 'bg-white border-slate-300 text-slate-900',
  in_progress: 'bg-blue-50 border-blue-400 text-slate-900',
  done: 'bg-green-50 border-green-500 text-slate-900',
};

export function TaskNode({ data }: { data: { task: Task } }) {
  const { task } = data;
  return (
    <div
      className={`flex h-[76px] w-[150px] flex-col justify-center rounded-lg border-2 px-3 py-2 text-xs shadow-sm ${statusClasses[task.status]}`}
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
