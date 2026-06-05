# Issue #8 — React Flow 기반 DAG 렌더 (read-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Canvas.tsx` 안에서 `/api/tasks` fetch → React Flow + dagre 자동 레이아웃으로 DAG 시각화. 노드는 제목 + 상태별 색의 단순 카드 (퀘스트 카드는 #22), edges 는 `prerequisites` 기반. 줌/팬/미니맵 동작. 편집 인터랙션은 후속 이슈.

**Architecture:** Canvas 가 client component (`'use client'`) 가 되어 `useEffect` 로 마운트 시 task 목록 fetch. `lib/dag.ts` 는 순수 함수 모듈 — `buildGraph(tasks)` 로 React Flow 형식의 nodes/edges 구성, `applyLayout(nodes, edges)` 로 dagre 좌표 적용. 노드 컴포넌트(`TaskNode`)는 단순 status 색 박스. 스파이크 [#2](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/2) 에서 검증한 설정값을 그대로 사용 ([04-quest-game-ui §8](../planning/04-quest-game-ui.md#8-implementation-hints-spike-2-결과-반영)).

**Tech Stack:** reactflow 11 · dagre 0.8 · Next.js App Router (client component) · Vitest (lib/dag 단위 테스트)

**Issue:** [#8 React Flow 기반 DAG 렌더](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/8)
**Branch model:** `feature/8-dag-render → main` (트렁크 기반)

---

## File Structure

| File | Purpose |
|---|---|
| `lib/dag.ts` | 순수 함수: `buildGraph(tasks)`, `applyLayout(nodes, edges)`. Task → React Flow 노드/엣지 변환 + dagre 좌표 부여. |
| `lib/dag.test.ts` | Vitest 단위 테스트 — `buildGraph` 의 노드/엣지 매핑 정확성. |
| `app/components/TaskNode.tsx` | React Flow custom node — 제목 + 상태별 색의 단순 카드. #22 에서 퀘스트 카드로 교체될 예정. |
| `app/components/Canvas.tsx` | 클라이언트 컴포넌트로 리팩토링 — fetch + ReactFlow 렌더. 빈 상태/로딩/에러는 최소 fallback (#18 에서 polish). |
| `package.json` | reactflow + dagre + @types/dagre 의존성 추가. |

**Not creating** (각자 후속 이슈에서):
- 노드 클릭 → 드로어 (#10)
- 드래그로 엣지 생성 (#11)
- 더블클릭 상태 토글 (#12)
- 빈/로딩/에러 polish (#18)
- 퀘스트 카드 디자인 + 해금 애니메이션 (#22)

---

## Task 0: Feature 브랜치

- [ ] **Step 0.1: main 최신화 + 분기**

```bash
git checkout main && git pull origin main && git checkout -b feature/8-dag-render
```

Expected:
- `main` 동기화 (#7 머지 포함)
- `Switched to a new branch 'feature/8-dag-render'`

---

## Task 1: 의존성 설치

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1.1: reactflow + dagre + @types/dagre 설치**

```bash
npm install reactflow dagre
npm install -D @types/dagre
```

Expected: `added N packages...` 정상 종료.

- [ ] **Step 1.2: 버전 확인**

```bash
node -e "const p=require('./package.json'); console.log({ reactflow: p.dependencies.reactflow, dagre: p.dependencies.dagre, '@types/dagre': p.devDependencies['@types/dagre'] })"
```

Expected: 3개 모두 정의된 객체.

- [ ] **Step 1.3: Commit**

```bash
git add package.json package-lock.json && git commit -m "chore: add reactflow + dagre deps (#8)"
```

---

## Task 2: `lib/dag.ts` (TDD)

**Files:**
- Create: `lib/dag.ts`
- Create: `lib/dag.test.ts`

- [ ] **Step 2.1: 실패하는 테스트 작성 — `lib/dag.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '@/lib/tasks';

// Mock mongo (lib/dag imports nothing from mongo, but mock guards transitive imports if any)
vi.mock('@/lib/mongo', () => ({ default: Promise.resolve(null) }));

import { buildGraph, applyLayout } from '@/lib/dag';

function mkTask(id: string, prereqs: string[] = [], extra: Partial<Task> = {}): Task {
  return {
    id,
    title: `task-${id}`,
    status: 'todo',
    priority: 3,
    prerequisites: prereqs,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

describe('buildGraph', () => {
  it('returns empty arrays for empty input', () => {
    const { nodes, edges } = buildGraph([]);
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });

  it('creates one node, zero edges for single task with no prereqs', () => {
    const { nodes, edges } = buildGraph([mkTask('a')]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('a');
    expect(nodes[0].type).toBe('task');
    expect(nodes[0].data.task.id).toBe('a');
    expect(edges).toEqual([]);
  });

  it('creates edge from prereq → dependent (B is prereq of A → edge B→A)', () => {
    const { nodes, edges } = buildGraph([mkTask('a', ['b']), mkTask('b')]);
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ source: 'b', target: 'a' });
  });

  it('creates multiple edges for task with multiple prereqs', () => {
    const { edges } = buildGraph([
      mkTask('a', ['b', 'c']),
      mkTask('b'),
      mkTask('c'),
    ]);
    expect(edges).toHaveLength(2);
    expect(edges.map((e) => `${e.source}→${e.target}`).sort()).toEqual([
      'b→a',
      'c→a',
    ]);
  });

  it('every edge has a unique id', () => {
    const { edges } = buildGraph([
      mkTask('a', ['b', 'c']),
      mkTask('b'),
      mkTask('c'),
    ]);
    const ids = new Set(edges.map((e) => e.id));
    expect(ids.size).toBe(edges.length);
  });
});

describe('applyLayout', () => {
  it('assigns numeric x/y positions to every node', () => {
    const { nodes, edges } = buildGraph([
      mkTask('a', ['b']),
      mkTask('b'),
      mkTask('c', ['b']),
    ]);
    const laidOut = applyLayout(nodes, edges);
    expect(laidOut).toHaveLength(3);
    for (const n of laidOut) {
      expect(typeof n.position.x).toBe('number');
      expect(typeof n.position.y).toBe('number');
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    }
  });

  it('places downstream (dependent) nodes below their prerequisites (TB layout)', () => {
    const { nodes, edges } = buildGraph([mkTask('a', ['b']), mkTask('b')]);
    const laidOut = applyLayout(nodes, edges);
    const aPos = laidOut.find((n) => n.id === 'a')!.position;
    const bPos = laidOut.find((n) => n.id === 'b')!.position;
    // B is prereq of A → B should be above A in TB layout
    expect(bPos.y).toBeLessThan(aPos.y);
  });
});
```

- [ ] **Step 2.2: 테스트 실패 확인**

```bash
npm test
```

Expected: 모든 dag 테스트 실패 (모듈 없음). 기존 `lib/tasks.test.ts` 9개는 통과 유지.

- [ ] **Step 2.3: `lib/dag.ts` 작성**

```ts
import dagre from 'dagre';
import type { Task } from '@/lib/tasks';

export type FlowNode = {
  id: string;
  type: 'task';
  position: { x: number; y: number };
  data: { task: Task };
  sourcePosition?: 'top' | 'right' | 'bottom' | 'left';
  targetPosition?: 'top' | 'right' | 'bottom' | 'left';
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  type?: string;
};

/**
 * 스파이크에서 검증된 설정 ([04-quest-game-ui §8.1, §8.2]).
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

export function applyLayout(
  nodes: FlowNode[],
  edges: FlowEdge[],
): FlowNode[] {
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
      targetPosition: 'top' as const,
      sourcePosition: 'bottom' as const,
    };
  });
}
```

- [ ] **Step 2.4: 테스트 통과 확인**

```bash
npm test
```

Expected: 새 7개 + 기존 9개 = 16개 통과.

- [ ] **Step 2.5: 검증 (typecheck/lint/format)**

```bash
npm run typecheck && npm run lint && npm run format && npm run format:check
```

Expected: 모두 통과.

- [ ] **Step 2.6: Commit**

```bash
git add lib/dag.ts lib/dag.test.ts && git commit -m "feat(dag): add buildGraph + applyLayout (dagre, spike settings) + tests (#8)"
```

---

## Task 3: `TaskNode` 컴포넌트

**Files:**
- Create: `app/components/TaskNode.tsx`

- [ ] **Step 3.1: `app/components/TaskNode.tsx` 작성**

```tsx
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
```

- [ ] **Step 3.2: 타입 검사**

```bash
npm run typecheck
```

Expected: 출력 없음.

- [ ] **Step 3.3: Commit**

```bash
git add app/components/TaskNode.tsx && git commit -m "feat(ui): add TaskNode (simple status-colored card, replaced by quest card in #22) (#8)"
```

---

## Task 4: `Canvas` 클라이언트 컴포넌트로 리팩토링

**Files:**
- Modify: `app/components/Canvas.tsx`

- [ ] **Step 4.1: `app/components/Canvas.tsx` 전체 재작성**

```tsx
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
```

- [ ] **Step 4.2: 검증**

```bash
npm run typecheck && npm run lint && npm run format && npm run format:check && npm test
```

Expected: 모두 통과 (테스트 16/16).

- [ ] **Step 4.3: Commit**

```bash
git add app/components/Canvas.tsx && git commit -m "feat(ui): wire Canvas to /api/tasks with React Flow + dagre (#8)"
```

---

## Task 5: Smoke verification

- [ ] **Step 5.1: production build 확인**

```bash
npm run build
```

Expected: 마지막에 Route 표 — `/` 가 이전엔 `○ (Static)` 였는데 이제 client component 가 섞여서 `○` 그대로 유지될 가능성 (서버 컴포넌트가 클라이언트 컴포넌트를 import 하는 패턴은 정상). 어느 쪽이든 build 성공이면 OK.

- [ ] **Step 5.2: seed 데이터 생성 (dev 서버 띄운 상태에서 curl)**

먼저 dev 서버 시작:
```bash
npm run dev
```

새 터미널에서 mock DAG 생성 (3 태스크: 기획 → 디자인 → 통합):

```bash
# 1. 기획 (prereq 없음)
T1=$(curl -s -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"기획","priority":5}' \
  | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).task.id))")
echo "T1=$T1"

# 2. 디자인 (prereq = 기획), in_progress
T2=$(curl -s -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d "{\"title\":\"디자인\",\"status\":\"in_progress\",\"priority\":4,\"prerequisites\":[\"$T1\"]}" \
  | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).task.id))")
echo "T2=$T2"

# 3. 통합 (prereq = 디자인)
T3=$(curl -s -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d "{\"title\":\"통합\",\"priority\":3,\"prerequisites\":[\"$T2\"]}" \
  | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).task.id))")
echo "T3=$T3"

# 4. 기획을 done 으로 (테스트용)
curl -s -X PATCH "http://localhost:3000/api/tasks/$T1" \
  -H 'Content-Type: application/json' \
  -d '{"status":"done"}' > /dev/null
echo "T1 → done"
```

- [ ] **Step 5.3: 브라우저 시각 확인**

http://localhost:3000 새로고침. **체크리스트**:

- [ ] 3개 노드가 우측 캔버스에 표시됨 (기획 / 디자인 / 통합)
- [ ] 위→아래 흐름: 기획(맨 위) → 디자인 → 통합(맨 아래)
- [ ] 색상: 기획 = 초록 (done), 디자인 = 파랑 (in_progress), 통합 = 흰색 (todo)
- [ ] 노드 사이 엣지가 연결되어 있음 (smoothstep 곡선)
- [ ] 좌하단 zoom 컨트롤 동작 (`+` `-` `fit view`)
- [ ] 우하단 미니맵 — 흰 배경, 진회색 테두리, 그림자, 노드 색상 반영. **드래그/스크롤로 메인 뷰포트 이동/줌** 가능
- [ ] 마우스 드래그로 캔버스 팬, 스크롤로 줌 가능
- [ ] DevTools Console: 에러/경고 0

- [ ] **Step 5.4: cleanup (테스트 데이터 삭제)**

DB 비워두기:
```bash
# 3개 모두 삭제 (cascade 자동)
curl -s -X DELETE "http://localhost:3000/api/tasks/$T1" > /dev/null
curl -s -X DELETE "http://localhost:3000/api/tasks/$T2" > /dev/null
curl -s -X DELETE "http://localhost:3000/api/tasks/$T3" > /dev/null
```

브라우저 새로고침 → "아직 태스크가 없습니다" placeholder 표시 확인.

`Ctrl+C` 로 dev 서버 종료.

- [ ] **Step 5.5: 최종 git 상태**

```bash
git status --short
```

Expected: 빈 출력.

---

## Task 6: Push + PR + 머지

- [ ] **Step 6.1: plan commit + push**

```bash
git add docs/superpowers/plans/2026-06-05-issue-08-dag-render.md && \
git commit -m "docs: add implementation plan for #8 DAG render" && \
git push -u origin feature/8-dag-render
```

- [ ] **Step 6.2: PR 생성**

```bash
gh pr create --repo boostcampwm-snu-2026-1/flowtodo-pkdje \
  --base main --head feature/8-dag-render \
  --title "feat: React Flow + dagre DAG render in Canvas (#8)" \
  --body "$(cat <<'EOF'
Closes #8.

## 변경
- **`lib/dag.ts`** — 순수 함수 모듈
  - `buildGraph(tasks)` → `{ nodes, edges }`. 엣지는 `prereq → dependent` 방향 (선행이 source).
  - `applyLayout(nodes, edges)` → dagre 로 좌표 부여. 스파이크 검증 설정 사용 (`nodesep:12 / ranksep:28 / ranker:'tight-tree'` + 카드 150×76).
- **`lib/dag.test.ts`** — 7개 단위 테스트 (빈 그래프, 단일 노드, 단일 엣지, 다중 prereq, 엣지 id 유일성, 좌표 유효성, TB 방향 검증)
- **`app/components/TaskNode.tsx`** — React Flow custom node. 제목 + 상태 텍스트, 상태별 색 (todo/in_progress/done). #22 에서 퀘스트 카드로 교체.
- **`app/components/Canvas.tsx`** — `'use client'` 로 전환. `/api/tasks` fetch, 로딩/에러/빈/렌더 4가지 상태 분기. ReactFlow + Background + Controls + MiniMap (pannable + zoomable + 테두리 스타일).

## 검증
- [x] `npm run typecheck` 통과
- [x] `npm run lint` 통과
- [x] `npm run format:check` 통과
- [x] `npm test` — 16/16 통과 (`lib/tasks.test.ts` 9 + `lib/dag.test.ts` 7)
- [x] `npm run build` 성공
- [x] dev seed (3 노드 DAG, 상태 done/in_progress/todo) → 브라우저에서 자동 레이아웃 + 색상 + 줌/팬/미니맵 정상 동작 확인

## 후속
- [#9 태스크 생성 모달](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/9) — Header 의 `+ 새 태스크` 버튼 wiring
- [#10 노드 클릭 → 편집 드로어](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/10)
- [#11 의존성 엣지 드래그 생성](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/11)
- [#12 더블클릭 상태 토글](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/12)
- [#18 빈/로딩/에러 polish](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/18) — 현재의 minimal fallback 을 시각적으로 다듬음
- [#22 퀘스트 카드 노드](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/22) — TaskNode 를 퀘스트 카드 디자인으로 교체 + 해금 애니메이션
EOF
)"
```

- [ ] **Step 6.3: 머지 + 정리**

```bash
gh pr merge <PR번호> --repo boostcampwm-snu-2026-1/flowtodo-pkdje --squash
# y
git checkout main && git pull origin main
```

---

## Definition of Done

1. 이슈 [#8 AC](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/8) 4개 다 충족:
   - 마운트 시 `/api/tasks` fetch (Task 4.1) ✓
   - dagre 로 자동 레이아웃 (Task 2.3) ✓
   - 노드 제목 + 상태별 색 (Task 3) ✓
   - 줌/팬 동작 (Task 4.1, ReactFlow + Controls) ✓
2. 스파이크 설정 ([04-quest-game-ui §8](../planning/04-quest-game-ui.md#8-implementation-hints-spike-2-결과-반영)) 적용 — dagre 컴팩트 설정, fitView minZoom 0.6, MiniMap pannable+zoomable+테두리.
3. typecheck / lint / format / test (16/16) / build 모두 통과.
4. seed 3 노드 시각 검증 완료.
5. PR 머지 후 main 반영.

---

## After Merge

- 이슈 #8 자동 close.
- 다음 plan: [#9 태스크 생성 모달](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/9) — Header `+ 새 태스크` 클릭 → 모달 → POST → 그래프 즉시 갱신.
