# Issue #14 — 추천 패널 UI (NEXT QUEST) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sidebar 의 `▶ NEXT QUEST` placeholder 자리에 추천 엔진 결과 Top 3 카드 표시. 카드 클릭 → React Flow 카메라가 노드로 이동 + 편집 드로어 열림. tasks 가 바뀌면 자동 재계산.

**Architecture:** 두 단계 변경. **A) lib/recommender 확장** — `Recommendation.unlocks: string[]` 필드와 `computeImpactSet` 신규 export. computeImpact 는 호환 유지 (내부에서 computeImpactSet 호출). **B) UI** — `ReactFlowProvider` 로 page 전체 감싸기 + Sidebar 의 NEXT QUEST 자리를 신규 `NextQuestPanel` 로 교체. NextQuestPanel 은 store.tasks 를 useMemo 로 `computeRecommendations` 에 흘리고, `useReactFlow().setCenter` + `selectTask` 로 카드 클릭 시 카메라 이동 + 드로어 강조 트리거.

**Tech Stack:** React Flow 11 `useReactFlow` · 기존 Zustand store · 기존 lib/recommender · Tailwind

**Issue:** [#14 추천 패널 UI](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/14)
**Spec:** [docs/superpowers/specs/2026-06-07-issue-14-next-quest-panel-design.md](../specs/2026-06-07-issue-14-next-quest-panel-design.md)
**Branch model:** `feature/14-next-quest-panel → main` (트렁크 기반)

---

## File Structure

| File | Purpose |
|---|---|
| `lib/recommender.ts` | `computeImpactSet` 신규 export, `computeImpact` 를 그 위에 얹음. `Recommendation.unlocks` 필드 추가. `computeRecommendations` 가 unlocks 채움. |
| `lib/recommender.test.ts` | `computeImpactSet` 2 케이스 추가. end-to-end 케이스에 `unlocks` assert 한 줄 추가. |
| `app/components/NextQuestPanel.tsx` | 신규 — store 구독 + recommendations 계산 + Top 3 카드 + 클릭 핸들러. ~140줄. NextQuestPanel + QuestCard 두 컴포넌트 한 파일. |
| `app/components/Sidebar.tsx` | NEXT QUEST `<Section />` 만 `<NextQuestPanel />` 로 교체. 나머지 그대로. |
| `app/page.tsx` | `'use client'` 디렉티브 + `<ReactFlowProvider>` 로 root 감쌈. |

**Not in this plan** (의도된 누락):
- 핀/snooze → #15
- 가중치 슬라이더 → #17
- SIDE QUESTS / 진행 현황 → #23
- 이모지 picker → #23
- 퀘스트 카드 노드 (DAG 노드 리뉴얼) → #22
- unlock 펄스 애니메이션 → #22

---

## Task 0: Feature 브랜치

- [ ] **Step 0.1: main 최신화 + 분기**

```bash
git checkout main && git pull origin main && git checkout -b feature/14-next-quest-panel
```

Expected:
- `main` 동기화 (#13 머지 + #14 spec 포함)
- `Switched to a new branch 'feature/14-next-quest-panel'`

---

## Task 1: `computeImpactSet` (TDD)

**Files:**
- Modify: `lib/recommender.test.ts`, `lib/recommender.ts`

- [ ] **Step 1.1: import 확장**

`lib/recommender.test.ts` 의 import 라인을 다음으로 교체:

```ts
import {
  computeImpact,
  computeImpactSet,
  computeReadySet,
  computeRecommendations,
  computeScore,
  RecommenderCycleError,
} from '@/lib/recommender';
```

- [ ] **Step 1.2: 2 케이스 추가**

`lib/recommender.test.ts` 끝의 `describe('computeRecommendations', ...)` **위**에 다음 describe 블록 삽입:

```ts
describe('computeImpactSet', () => {
  it('returns same size as computeImpact', () => {
    const tasks = [mkTask('a'), mkTask('b', ['a']), mkTask('c', ['b'])];
    const sets = computeImpactSet(tasks);
    const nums = computeImpact(tasks);
    for (const [id, set] of sets) {
      expect(set.size).toBe(nums.get(id));
    }
  });

  it('exposes downstream ids (linear A→B→C → A.unlocks={B,C})', () => {
    const tasks = [mkTask('a'), mkTask('b', ['a']), mkTask('c', ['b'])];
    const sets = computeImpactSet(tasks);
    expect(Array.from(sets.get('a')!).sort()).toEqual(['b', 'c']);
    expect(Array.from(sets.get('b')!)).toEqual(['c']);
  });
});
```

- [ ] **Step 1.3: 실패 확인**

```bash
npx vitest run lib/recommender.test.ts
```

Expected: 2 FAIL — `computeImpactSet` undefined (또는 import 에러).

- [ ] **Step 1.4: 구현 — `lib/recommender.ts` 의 `computeImpact` 를 `computeImpactSet` 위에 얹음**

`lib/recommender.ts` 의 `computeImpact` 함수 전체 (현재 39~69줄 근처) 를 다음으로 교체:

```ts
export function computeImpactSet(tasks: Task[]): Map<string, Set<string>> {
  const downstream = new Map<string, string[]>();
  for (const t of tasks) {
    for (const p of t.prerequisites) {
      if (!downstream.has(p)) downstream.set(p, []);
      downstream.get(p)!.push(t.id);
    }
  }

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map<string, Set<string>>();

  function dfs(id: string): Set<string> {
    const cached = memo.get(id);
    if (cached) return cached;

    const result = new Set<string>();
    for (const child of downstream.get(id) ?? []) {
      const childTask = taskById.get(child);
      if (!childTask) continue; // dangling
      if (childTask.status !== 'done') result.add(child);
      for (const grand of dfs(child)) result.add(grand);
    }
    memo.set(id, result);
    return result;
  }

  const out = new Map<string, Set<string>>();
  for (const t of tasks) out.set(t.id, dfs(t.id));
  return out;
}

export function computeImpact(tasks: Task[]): Map<string, number> {
  const sets = computeImpactSet(tasks);
  const out = new Map<string, number>();
  for (const [id, set] of sets) out.set(id, set.size);
  return out;
}
```

- [ ] **Step 1.5: 통과 확인 + 회귀**

```bash
npx vitest run
```

Expected: `Tests 38 passed (38)` (기존 36 + 신규 2).

---

## Task 2: `Recommendation.unlocks` + computeRecommendations 확장 (TDD)

**Files:**
- Modify: `lib/recommender.test.ts`, `lib/recommender.ts`

- [ ] **Step 2.1: end-to-end 케이스에 assert 한 줄 추가**

`lib/recommender.test.ts` 의 `end-to-end diamond with one done` 케이스에서 다음 줄을 추가:

```ts
    expect(recs[0].task.id).toBe('c');
    expect(recs[0].unlocks).toEqual(['d']);   // ← 추가
    expect(recs[1].unlocks).toEqual(['d']);   // ← 추가
```

전체 케이스 모양:

```ts
  it('end-to-end diamond with one done: ordering reflects ready+score', () => {
    const tasks = [
      mkTask('a', [], { status: 'done', priority: 3 }),
      mkTask('b', ['a'], { priority: 3 }),
      mkTask('c', ['a'], { priority: 4 }),
      mkTask('d', ['b', 'c'], { priority: 5 }),
    ];
    const recs = computeRecommendations(tasks);
    expect(recs.map((r) => r.task.id)).toEqual(['c', 'b']);
    expect(recs[0].impact).toBe(1);
    expect(recs[0].score).toBeGreaterThan(recs[1].score);
    expect(recs[0].unlocks).toEqual(['d']);
    expect(recs[1].unlocks).toEqual(['d']);
  });
```

- [ ] **Step 2.2: 실패 확인**

```bash
npx vitest run lib/recommender.test.ts
```

Expected: 1 FAIL — `recs[0].unlocks` 가 undefined.

- [ ] **Step 2.3: `Recommendation` 타입에 unlocks 필드 추가**

`lib/recommender.ts` 의 `Recommendation` 타입을 다음으로 교체:

```ts
export type Recommendation = {
  task: Task;
  ready: true;
  impact: number;
  score: number;
  breakdown: {
    priorityComponent: number;
    impactComponent: number;
  };
  unlocks: string[];
};
```

- [ ] **Step 2.4: `computeRecommendations` 가 unlocks 채우도록 수정**

`lib/recommender.ts` 의 `computeRecommendations` 함수 body 를 다음으로 교체:

```ts
export function computeRecommendations(
  tasks: Task[],
  weights: Weights = DEFAULT_WEIGHTS,
): Recommendation[] {
  if (detectCycle(tasks)) {
    throw new RecommenderCycleError();
  }

  const ready = computeReadySet(tasks);
  if (ready.length === 0) return [];

  const impactSet = computeImpactSet(tasks);
  let maxImpact = 0;
  for (const set of impactSet.values()) {
    if (set.size > maxImpact) maxImpact = set.size;
  }

  const recs: Recommendation[] = ready.map((task) => {
    const set = impactSet.get(task.id) ?? new Set<string>();
    const impact = set.size;
    const { score, breakdown } = computeScore(task, impact, maxImpact, weights);
    return {
      task,
      ready: true,
      impact,
      score,
      breakdown,
      unlocks: Array.from(set),
    };
  });

  recs.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.task.priority !== a.task.priority) {
      return b.task.priority - a.task.priority;
    }
    const aDue = a.task.dueDate ? Date.parse(a.task.dueDate) : Infinity;
    const bDue = b.task.dueDate ? Date.parse(b.task.dueDate) : Infinity;
    if (aDue !== bDue) return aDue - bDue;
    const aCreated = Date.parse(a.task.createdAt);
    const bCreated = Date.parse(b.task.createdAt);
    if (aCreated !== bCreated) return aCreated - bCreated;
    return a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0;
  });

  return recs;
}
```

- [ ] **Step 2.5: 통과 확인**

```bash
npx vitest run
```

Expected: `Tests 38 passed (38)` (모든 기존 + 신규 통과).

- [ ] **Step 2.6: Commit (recommender 변경)**

```bash
git add lib/recommender.ts lib/recommender.test.ts
git commit -m "feat(recommender): expose unlocks via computeImpactSet (#14)"
```

---

## Task 3: `<ReactFlowProvider>` 로 page 감싸기

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 3.1: page.tsx 전체 교체**

`app/page.tsx` 를 다음으로 교체:

```tsx
'use client';

import { ReactFlowProvider } from 'reactflow';
import { Canvas } from './components/Canvas';
import { CreateTaskModal } from './components/CreateTaskModal';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TaskDrawer } from './components/TaskDrawer';

export default function Home() {
  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <Canvas />
          <TaskDrawer />
        </div>
        <CreateTaskModal />
      </div>
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 3.2: 타입 + lint**

```bash
npx tsc --noEmit && npx next lint
```

Expected: 출력 없음 + `No ESLint warnings or errors`.

- [ ] **Step 3.3: 회귀 — 기존 동작 그대로**

```bash
npm run dev
```

브라우저에서 http://localhost:3000:
- 노드 클릭 → 드로어 열림 (#10 그대로)
- 더블클릭 → 상태 순환 (#12 그대로)
- 새 태스크 모달 (#9) 그대로
- 캔버스 fit/zoom/pan 정상

확인 후 dev 서버 종료.

---

## Task 4: `NextQuestPanel.tsx` 신규

**Files:**
- Create: `app/components/NextQuestPanel.tsx`

- [ ] **Step 4.1: 파일 작성**

`app/components/NextQuestPanel.tsx` 를 다음으로 생성:

```tsx
'use client';

import { useMemo } from 'react';
import { useReactFlow } from 'reactflow';
import { useAppStore } from '@/lib/store';
import {
  computeRecommendations,
  type Recommendation,
  RecommenderCycleError,
} from '@/lib/recommender';

const NODE_WIDTH = 150;
const NODE_HEIGHT = 76;
const TOP_N = 3;

type ComputeResult =
  | { kind: 'ok'; recs: Recommendation[] }
  | { kind: 'cycle' };

export function NextQuestPanel() {
  const tasks = useAppStore((s) => s.tasks);
  const status = useAppStore((s) => s.tasksStatus);
  const selectTask = useAppStore((s) => s.selectTask);
  const { setCenter, getNode } = useReactFlow();

  const result: ComputeResult = useMemo(() => {
    try {
      return { kind: 'ok', recs: computeRecommendations(tasks) };
    } catch (err) {
      if (err instanceof RecommenderCycleError) return { kind: 'cycle' };
      throw err;
    }
  }, [tasks]);

  const titleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) m.set(t.id, t.title);
    return m;
  }, [tasks]);

  const top = result.kind === 'ok' ? result.recs.slice(0, TOP_N) : [];

  function focus(taskId: string) {
    const node = getNode(taskId);
    if (node) {
      setCenter(
        node.position.x + NODE_WIDTH / 2,
        node.position.y + NODE_HEIGHT / 2,
        { zoom: 1.2, duration: 400 },
      );
    }
    selectTask(taskId);
  }

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        ▶ NEXT QUEST ({top.length})
      </h2>
      <PanelBody
        result={result}
        status={status}
        recs={top}
        titleById={titleById}
        onCardClick={focus}
      />
    </section>
  );
}

function PanelBody({
  result,
  status,
  recs,
  titleById,
  onCardClick,
}: {
  result: ComputeResult;
  status: 'idle' | 'loading' | 'ready' | 'error';
  recs: Recommendation[];
  titleById: Map<string, string>;
  onCardClick: (id: string) => void;
}) {
  if (status === 'idle' || status === 'loading') return <Placeholder text="로딩 중..." />;
  if (status === 'error') return <Placeholder text="추천을 표시할 수 없습니다" />;
  if (result.kind === 'cycle') {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-700">
        그래프에 사이클이 있습니다. 편집기에서 의존성을 확인해 주세요.
      </div>
    );
  }
  if (recs.length === 0) {
    return <Placeholder text="아직 시작 가능한 작업이 없어요" />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {recs.map((r, i) => (
        <li key={r.task.id}>
          <QuestCard
            rec={r}
            isLeader={i === 0}
            unlocksLabel={formatUnlocks(r.unlocks, titleById)}
            onClick={() => onCardClick(r.task.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function QuestCard({
  rec,
  isLeader,
  unlocksLabel,
  onClick,
}: {
  rec: Recommendation;
  isLeader: boolean;
  unlocksLabel: string | null;
  onClick: () => void;
}) {
  const stars = '★'.repeat(rec.task.priority) + '☆'.repeat(5 - rec.task.priority);
  const tone = isLeader
    ? 'border-orange-500 bg-orange-50'
    : 'border-slate-300 bg-white';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border-2 px-3 py-2 text-left transition-colors hover:bg-slate-50 ${tone}`}
    >
      <div className="flex items-center gap-1 text-sm font-medium text-slate-900">
        <span>⚡</span>
        <span className="truncate">{rec.task.title}</span>
      </div>
      <div className="mt-1 text-xs text-amber-500">{stars}</div>
      <div className="text-[11px] text-slate-500">score {rec.score.toFixed(2)}</div>
      {unlocksLabel && (
        <div className="mt-1 truncate text-[11px] text-slate-600">▷ {unlocksLabel} 해금</div>
      )}
    </button>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
      {text}
    </div>
  );
}

function formatUnlocks(
  unlocks: string[],
  titleById: Map<string, string>,
): string | null {
  if (unlocks.length === 0) return null;
  const titles = unlocks
    .map((id) => titleById.get(id))
    .filter((t): t is string => !!t);
  if (titles.length === 0) return null;
  if (titles.length <= 2) return titles.join(', ');
  const shown = titles.slice(0, 2).join(', ');
  return `${shown} 외 ${titles.length - 2}개`;
}
```

- [ ] **Step 4.2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 출력 없음.

---

## Task 5: Sidebar 에서 NextQuestPanel 사용

**Files:**
- Modify: `app/components/Sidebar.tsx`

- [ ] **Step 5.1: 교체**

`app/components/Sidebar.tsx` 를 다음으로 교체:

```tsx
import { NextQuestPanel } from './NextQuestPanel';

function PlaceholderBox({ note }: { note: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
      {note}
    </div>
  );
}

function Section({ label, note }: { label: string; note: string }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </h2>
      <PlaceholderBox note={note} />
    </section>
  );
}

export function Sidebar() {
  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
      <NextQuestPanel />
      <Section
        label="⚡ SIDE QUESTS"
        note="사이드 퀘스트는 #23 에서 채워집니다"
      />
      <Section
        label="진행 현황"
        note="메인/사이드 진행률은 #23 에서 채워집니다"
      />
    </aside>
  );
}
```

- [ ] **Step 5.2: 타입 + lint**

```bash
npx tsc --noEmit && npx next lint
```

Expected: 출력 없음 + `No ESLint warnings or errors`.

---

## Task 6: 자동 검증

- [ ] **Step 6.1: Prettier**

```bash
npx prettier --write lib/recommender.ts lib/recommender.test.ts app/components/NextQuestPanel.tsx app/components/Sidebar.tsx app/page.tsx
```

Expected: 각 파일 unchanged 또는 자동 정렬.

- [ ] **Step 6.2: Vitest 회귀**

```bash
npx vitest run
```

Expected: `Tests 38 passed (38)`.

- [ ] **Step 6.3: Production build**

```bash
rm -rf .next && npx next build
```

Expected: `✓ Compiled successfully`, 4 routes. `/` 사이즈는 #13 후 (77 kB) 보다 살짝 증가 예상.

---

## Task 7: Smoke 시나리오 (수동, 브라우저)

```bash
npm run dev
```

http://localhost:3000 에서 **6 시나리오**:

1. **빈 상태**: 캔버스 비어있음 → NEXT QUEST 자리에 `"아직 시작 가능한 작업이 없어요"` placeholder.
2. **단일 ready**: `+ 새 태스크` → "로그인 API" priority 4 생성 → 카드 1개, 1등 강조 (주황 테두리), `★★★★☆`, `score X.XX`, ▷ 라인 없음. 카드 클릭 → 캔버스 카메라가 그 노드로 줌 + 드로어 열림.
3. **여러 ready + Top 3**: 추가로 task 3개 더 만들기 (다양한 priority) → 정확히 3개만 표시, score 내림차순 정렬, 1등만 주황 강조.
4. **체인 + 부분 done**: `A` 만들고 `B` 의 prereq=A 로 만들고 `C` 의 prereq=B 로. → 처음엔 ready=[A], 카드에 "▷ B, C 해금". A 더블클릭 (todo→in_progress→done) → 패널 즉시 갱신, 이제 B 가 1등 ("▷ C 해금" 표시).
5. **드로어와 상호작용**: 패널의 1등 카드 클릭 (드로어가 다른 task 로 열려있던 상태에서) → 드로어 form 이 새 task 로 갈아끼움.
6. **상태 변화 즉시 반영**: 드로어에서 priority 변경 → 저장 → 패널의 점수가 그 자리에서 바뀜.

추가:
7. **카메라 이동 정확성**: ready task 가 화면 밖에 있도록 캔버스를 일부러 멀리 panning 한 뒤 카드 클릭 → 카메라가 부드럽게(400ms) 그 노드로 이동.

모두 통과해야 다음 단계.

- [ ] dev 서버 종료 (Ctrl+C).

---

## Task 8: Commit / Push / PR / Merge

- [ ] **Step 8.1: UI 변경 commit**

```bash
git add app/components/NextQuestPanel.tsx app/components/Sidebar.tsx app/page.tsx
git commit -m "$(cat <<'EOF'
feat(panel): NEXT QUEST panel with Top 3 recommendations (#14)

- New NextQuestPanel subscribes to store.tasks and recomputes
  recommendations via useMemo. Top 3 cards show title / stars /
  score / "▷ X, Y 해금" preview (drawn from Recommendation.unlocks).
- Card click calls useReactFlow().setCenter to focus the node
  (with smooth 400ms animation) and selectTask to open the drawer
  with the existing ring highlight.
- page.tsx wrapped in <ReactFlowProvider> so the panel (outside
  Canvas) can share the same React Flow instance.
- Sidebar swaps the NEXT QUEST placeholder for the new panel;
  SIDE QUESTS and 진행 현황 remain placeholders for #23.

Empty / loading / error / cycle states each show their own
placeholder. Leader card carries the orange tone.
EOF
)"
```

- [ ] **Step 8.2: Plan 문서 commit**

```bash
git add docs/superpowers/plans/2026-06-07-issue-14-next-quest-panel.md
git commit -m "docs: add #14 next quest panel implementation plan"
```

- [ ] **Step 8.3: Push**

```bash
git push -u origin feature/14-next-quest-panel
```

- [ ] **Step 8.4: PR 생성**

```bash
gh pr create --base main --head feature/14-next-quest-panel --title "feat: NEXT QUEST panel with recommendations (#14)" --body "$(cat <<'EOF'
Closes #14.

## Summary
- 신규 \`NextQuestPanel\` — Sidebar 의 NEXT QUEST 자리에 Top 3 카드 표시
- 카드: 제목 · ★ priority · score · ▷ 해금 미리보기 (다운스트림 task 제목 1~2개)
- 카드 클릭 → \`setCenter\` + \`selectTask\` (카메라 이동 + 드로어 열림)
- page.tsx 를 \`<ReactFlowProvider>\` 로 감쌈 → Sidebar 가 Canvas 와 같은 React Flow 인스턴스 공유
- \`lib/recommender\` 확장: \`Recommendation.unlocks: string[]\` 필드 + \`computeImpactSet\` 신규 export (\`computeImpact\` 는 호환 유지)

## State branches
- 빈 ready → placeholder "아직 시작 가능한 작업이 없어요"
- loading / error → 각자 placeholder
- 사이클 입력 → 빨강 메시지

## Test plan
- [x] \`npx tsc --noEmit\` clean
- [x] \`npx next lint\` clean
- [x] \`npx vitest run\` — 38/38 (기존 36 + 신규 2)
- [x] \`npx next build\` — 4 routes
- [x] Browser smoke: 빈/단일/Top3/체인+done/드로어 연동/즉시 반영/카메라 이동 — 7 시나리오 모두 통과

## Out of scope (intentional)
- 핀/snooze → #15
- 가중치 슬라이더 → #17
- SIDE QUESTS / 진행 현황 / 이모지 → #23
- 퀘스트 카드 노드 / unlock 펄스 → #22
EOF
)"
```

- [ ] **Step 8.5: PR 상태**

```bash
gh pr view <PR번호> --json mergeable,mergeStateStatus
```

Expected: `MERGEABLE` + `CLEAN`.

- [ ] **Step 8.6: Squash merge**

```bash
gh pr merge <PR번호> --squash --delete-branch
```

- [ ] **Step 8.7: Main 동기화**

```bash
git checkout main && git pull origin main && git log --oneline -3
```

Expected: 최상단 `feat: NEXT QUEST panel with recommendations (#14) (#PR번호)`.

- [ ] **Step 8.8: 이슈 자동 close 확인**

```bash
gh issue view 14 --json state
```

Expected: `"state":"CLOSED"`.

---

## 완료 기준

- [ ] AC 3개 모두 통과 (tasks 변경 시 재계산 / 카드 표시 / 카드 클릭 시 카메라 이동 + 강조)
- [ ] PR squash 머지 + 이슈 #14 자동 close
- [ ] `Tests 38 passed (38)` 새 baseline
- [ ] main 클린
