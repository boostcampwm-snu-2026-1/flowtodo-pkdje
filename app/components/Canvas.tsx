'use client';

import 'reactflow/dist/style.css';
import { useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import { TaskNode } from './TaskNode';
import { applyLayout, buildGraph } from '@/lib/dag';
import type { Task } from '@/lib/tasks';

const nodeTypes = { task: TaskNode };

type FetchState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; tasks: Task[] };

export function Canvas() {
  const [state, setState] = useState<FetchState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/tasks')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { tasks: Task[] }) => {
        if (!cancelled) setState({ kind: 'ready', tasks: data.tasks });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            kind: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const layout = useMemo(() => {
    if (state.kind !== 'ready') return null;
    const { nodes, edges } = buildGraph(state.tasks);
    return { nodes: applyLayout(nodes, edges), edges };
  }, [state]);

  return (
    <main className="relative flex-1 overflow-hidden bg-slate-100">
      {state.kind === 'loading' && <CenterMessage text="로딩 중..." />}
      {state.kind === 'error' && (
        <CenterMessage
          text={`불러오기 실패: ${state.message}`}
          textClass="text-red-500"
        />
      )}
      {state.kind === 'ready' && state.tasks.length === 0 && (
        <CenterMessage text="아직 태스크가 없습니다 (#9 에서 생성 모달 추가 예정)" />
      )}
      {state.kind === 'ready' && layout && state.tasks.length > 0 && (
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
