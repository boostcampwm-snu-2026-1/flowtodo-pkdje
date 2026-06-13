import dagre from 'dagre';
import { Position } from 'reactflow';
import type { Task } from '@/lib/tasks';
import { rewardText } from '@/lib/quest';

export type TaskNodeData = {
  task: Task;
  isReady: boolean;
  isLocked: boolean;
  isUnlocking: boolean;
  reward: string;
};

export type FlowNode = {
  id: string;
  type: 'task';
  position: { x: number; y: number };
  data: TaskNodeData;
  sourcePosition?: Position;
  targetPosition?: Position;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  type?: string;
};

/**
 * #22 퀘스트 카드 노드 — 카드 5줄 (icon · priority · title · meta · reward) 에 맞춘 크기.
 * 기존 150×76 → 200×120 으로 늘리고 dagre 간격도 조정.
 */
export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 120;
const DAGRE_CONFIG = {
  rankdir: 'TB',
  nodesep: 14,
  ranksep: 36,
  ranker: 'tight-tree',
  marginx: 16,
  marginy: 16,
} as const;

export type BuildOptions = {
  unlockingIds?: Set<string>;
};

export function buildGraph(
  tasks: Task[],
  options: BuildOptions = {},
): {
  nodes: FlowNode[];
  edges: FlowEdge[];
} {
  const unlockingIds = options.unlockingIds ?? new Set<string>();
  const statusById = new Map(tasks.map((t) => [t.id, t.status]));

  const nodes: FlowNode[] = tasks.map((task) => {
    const isReady =
      task.status === 'todo' &&
      task.prerequisites.every((p) => {
        const s = statusById.get(p);
        return s === undefined || s === 'done'; // dangling = done
      });
    const isLocked = task.status === 'todo' && !isReady;
    return {
      id: task.id,
      type: 'task',
      position: { x: 0, y: 0 },
      data: {
        task,
        isReady,
        isLocked,
        isUnlocking: unlockingIds.has(task.id),
        reward: rewardText(task, tasks),
      },
    };
  });

  const edges: FlowEdge[] = [];
  for (const task of tasks) {
    for (const prereqId of task.prerequisites) {
      edges.push({
        id: `${prereqId}->${task.id}`,
        source: prereqId,
        target: task.id,
        type: 'smoothstep',
      });
    }
  }

  return { nodes, edges };
}

export function applyLayout(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph(DAGRE_CONFIG);
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  return nodes.map((n) => {
    const laid = g.node(n.id);
    return {
      ...n,
      position: {
        x: laid.x - NODE_WIDTH / 2,
        y: laid.y - NODE_HEIGHT / 2,
      },
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    };
  });
}
