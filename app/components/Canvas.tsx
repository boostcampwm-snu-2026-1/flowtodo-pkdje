'use client';

import 'reactflow/dist/style.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
} from 'reactflow';
import { TaskNode } from './TaskNode';
import { applyLayout, buildGraph } from '@/lib/dag';
import { useAppStore } from '@/lib/store';
import { wouldCreateCycle } from '@/lib/recommender';
import type { Status, Task } from '@/lib/tasks';

const nodeTypes = { task: TaskNode };

export function Canvas() {
  const tasks = useAppStore((s) => s.tasks);
  const status = useAppStore((s) => s.tasksStatus);
  const error = useAppStore((s) => s.tasksError);
  const fetchTasks = useAppStore((s) => s.fetchTasks);

  const clickTimer = useRef<number | null>(null);
  const togglingRef = useRef<Set<string>>(new Set());
  const [edgeError, setEdgeError] = useState<string | null>(null);
  const errorTimerRef = useRef<number | null>(null);

  function showError(msg: string) {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setEdgeError(msg);
    errorTimerRef.current = window.setTimeout(() => {
      setEdgeError(null);
      errorTimerRef.current = null;
    }, 1600);
  }

  const handleNodeClick = (_: unknown, node: { id: string }) => {
    if (clickTimer.current !== null) return;
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      const current = useAppStore.getState().selectedTaskId;
      useAppStore.getState().selectTask(current === node.id ? null : node.id);
    }, 180);
  };

  const handleNodeDoubleClick = async (
    _: unknown,
    node: { id: string; data?: { task?: Task } },
  ) => {
    if (clickTimer.current !== null) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (togglingRef.current.has(node.id)) return;
    const task = node.data?.task;
    if (!task) return;
    const next = nextStatus(task.status);
    togglingRef.current.add(node.id);
    try {
      await useAppStore.getState().updateTask(node.id, { status: next });
    } catch (err) {
      console.error('[status toggle]', err);
    } finally {
      togglingRef.current.delete(node.id);
    }
  };

  const isValidConnection = (conn: Connection) => {
    const tasksNow = useAppStore.getState().tasks;
    if (!conn.source || !conn.target) return false;
    return !wouldCreateCycle(tasksNow, conn.source, conn.target);
  };

  const onConnect = async (conn: Connection) => {
    if (!conn.source || !conn.target) return;
    const tasksNow = useAppStore.getState().tasks;
    if (wouldCreateCycle(tasksNow, conn.source, conn.target)) {
      showError('순환 의존성이 생겨 거부됨');
      return;
    }
    const target = tasksNow.find((t) => t.id === conn.target);
    if (!target) return;
    if (target.prerequisites.includes(conn.source)) return; // 중복 silent
    try {
      await useAppStore.getState().updateTask(target.id, {
        prerequisites: [...target.prerequisites, conn.source],
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  const onEdgeClick = async (_: unknown, edge: Edge) => {
    const ok = window.confirm('이 의존성을 삭제할까요?');
    if (!ok) return;
    const tasksNow = useAppStore.getState().tasks;
    const target = tasksNow.find((t) => t.id === edge.target);
    if (!target) return;
    try {
      await useAppStore.getState().updateTask(target.id, {
        prerequisites: target.prerequisites.filter((p) => p !== edge.source),
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    return () => {
      if (clickTimer.current !== null) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
      if (errorTimerRef.current !== null) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
    };
  }, []);

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
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          isValidConnection={isValidConnection}
          deleteKeyCode={null}
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
      {edgeError && (
        <div className="absolute right-4 top-4 z-10 rounded-md bg-red-500 px-3 py-2 text-xs font-medium text-white shadow-lg">
          {edgeError}
        </div>
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

function nextStatus(s: Status): Status {
  return s === 'todo' ? 'in_progress' : s === 'in_progress' ? 'done' : 'todo';
}
