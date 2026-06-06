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
  const status = useAppStore((s) => s.tasksStatus);
  const error = useAppStore((s) => s.tasksError);
  const fetchTasks = useAppStore((s) => s.fetchTasks);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const layout = useMemo(() => {
    if (status !== 'ready') return null;
    const { nodes, edges } = buildGraph(tasks);
    return { nodes: applyLayout(nodes, edges), edges };
  }, [status, tasks]);

  return (
    <main className="relative flex-1 overflow-hidden bg-slate-100">
      {(status === 'idle' || status === 'loading') && (
        <CenterMessage text="로딩 중..." />
      )}
      {status === 'error' && (
        <CenterMessage
          text={`불러오기 실패: ${error ?? 'unknown'}`}
          textClass="text-red-500"
        />
      )}
      {status === 'ready' && tasks.length === 0 && (
        <CenterMessage text="아직 태스크가 없습니다. 우측 상단 + 새 태스크 로 시작하세요." />
      )}
      {status === 'ready' && layout && tasks.length > 0 && (
        <ReactFlow
          nodes={layout.nodes}
          edges={layout.edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.08, minZoom: 0.6, maxZoom: 1.5 }}
          minZoom={0.1}
          maxZoom={2}
          onNodeClick={(_, node) => {
            const current = useAppStore.getState().selectedTaskId;
            useAppStore
              .getState()
              .selectTask(current === node.id ? null : node.id);
          }}
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
