import dagre from 'dagre';
import { Position } from 'reactflow';
import type { Task } from '@/lib/tasks';

export type FlowNode = {
  id: string;
  type: 'task';
  position: { x: number; y: number };
  data: { task: Task };
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
 * 스파이크에서 검증된 설정 (04-quest-game-ui §8.1, §8.2).
 * 카드 크기 150×76, 컴팩트 dagre 설정.
 */
const NODE_WIDTH = 150;
const NODE_HEIGHT = 76;
const DAGRE_CONFIG = {
  rankdir: 'TB',
  nodesep: 12,
  ranksep: 28,
  ranker: 'tight-tree',
  marginx: 16,
  marginy: 16,
} as const;

export function buildGraph(tasks: Task[]): {
  nodes: FlowNode[];
  edges: FlowEdge[];
} {
  const nodes: FlowNode[] = tasks.map((task) => ({
    id: task.id,
    type: 'task',
    position: { x: 0, y: 0 }, // applyLayout 이 덮어씀
    data: { task },
  }));

  const edges: FlowEdge[] = [];
  for (const task of tasks) {
    for (const prereqId of task.prerequisites) {
      edges.push({
        id: `${prereqId}->${task.id}`,
        source: prereqId, // 선행 작업이 source (위)
        target: task.id, // 의존 작업이 target (아래)
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
        // dagre 의 (x, y) 는 노드 중심 → React Flow 가 기대하는 좌상단으로 변환
        x: laid.x - NODE_WIDTH / 2,
        y: laid.y - NODE_HEIGHT / 2,
      },
      // TB 레이아웃의 핸들 위치
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    };
  });
}
