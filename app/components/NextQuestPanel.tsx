'use client';

import { useEffect, useMemo } from 'react';
import { useReactFlow } from 'reactflow';
import { isSnoozedNow, useAppStore } from '@/lib/store';
import {
  computeRecommendations,
  type Recommendation,
  RecommenderCycleError,
} from '@/lib/recommender';
import { NODE_HEIGHT, NODE_WIDTH } from '@/lib/dag';

const TOP_N = 3;

type ComputeResult = { kind: 'ok'; recs: Recommendation[] } | { kind: 'cycle' };

export function NextQuestPanel() {
  const tasks = useAppStore((s) => s.tasks);
  const status = useAppStore((s) => s.tasksStatus);
  const selectTask = useAppStore((s) => s.selectTask);
  const pinnedIds = useAppStore((s) => s.pinnedIds);
  const snoozeUntil = useAppStore((s) => s.snoozeUntil);
  const weights = useAppStore((s) => s.weights);
  const togglePin = useAppStore((s) => s.togglePin);
  const snoozeTask = useAppStore((s) => s.snoozeTask);
  const unsnoozeTask = useAppStore((s) => s.unsnoozeTask);
  const { setCenter, getNode } = useReactFlow();

  // 만료된 snooze 자동 정리
  useEffect(() => {
    const now = Date.now();
    for (const [id, until] of Object.entries(snoozeUntil)) {
      if (until <= now) unsnoozeTask(id);
    }
  }, [snoozeUntil, unsnoozeTask]);

  const result: ComputeResult = useMemo(() => {
    try {
      return { kind: 'ok', recs: computeRecommendations(tasks, weights) };
    } catch (err) {
      if (err instanceof RecommenderCycleError) return { kind: 'cycle' };
      throw err;
    }
  }, [tasks, weights]);

  const titleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) m.set(t.id, t.title);
    return m;
  }, [tasks]);

  // pinned 가 위로 + snoozed 제외
  const ordered = useMemo(() => {
    if (result.kind !== 'ok') return [];
    const pinnedSet = new Set(pinnedIds);
    const visible = result.recs.filter(
      (r) => !isSnoozedNow(snoozeUntil, r.task.id),
    );
    return [
      ...visible.filter((r) => pinnedSet.has(r.task.id)),
      ...visible.filter((r) => !pinnedSet.has(r.task.id)),
    ];
  }, [result, pinnedIds, snoozeUntil]);

  const top = ordered.slice(0, TOP_N);
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

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
        pinnedSet={pinnedSet}
        onCardClick={focus}
        onPin={togglePin}
        onSnooze={snoozeTask}
      />
    </section>
  );
}

function PanelBody({
  result,
  status,
  recs,
  titleById,
  pinnedSet,
  onCardClick,
  onPin,
  onSnooze,
}: {
  result: ComputeResult;
  status: 'idle' | 'loading' | 'ready' | 'error';
  recs: Recommendation[];
  titleById: Map<string, string>;
  pinnedSet: Set<string>;
  onCardClick: (id: string) => void;
  onPin: (id: string) => void;
  onSnooze: (id: string) => void;
}) {
  if (status === 'idle' || status === 'loading') {
    return <Placeholder text="로딩 중..." />;
  }
  if (status === 'error') {
    return <Placeholder text="추천을 표시할 수 없습니다" />;
  }
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
            isPinned={pinnedSet.has(r.task.id)}
            unlocksLabel={formatUnlocks(r.unlocks, titleById)}
            onClick={() => onCardClick(r.task.id)}
            onPin={() => onPin(r.task.id)}
            onSnooze={() => onSnooze(r.task.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function QuestCard({
  rec,
  isLeader,
  isPinned,
  unlocksLabel,
  onClick,
  onPin,
  onSnooze,
}: {
  rec: Recommendation;
  isLeader: boolean;
  isPinned: boolean;
  unlocksLabel: string | null;
  onClick: () => void;
  onPin: () => void;
  onSnooze: () => void;
}) {
  // priority 1 이 가장 높음 → 6-priority 만큼 채움
  const filled = 6 - rec.task.priority;
  const stars = '★'.repeat(filled) + '☆'.repeat(5 - filled);
  const tone = isLeader
    ? 'border-orange-500 bg-orange-50'
    : isPinned
      ? 'border-amber-400 bg-amber-50'
      : 'border-slate-300 bg-white';
  return (
    <div
      className={`group relative rounded-lg border-2 transition-colors hover:bg-slate-50 ${tone}`}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full px-3 py-2 text-left"
      >
        <div className="flex items-center gap-1 text-sm font-medium text-slate-900">
          <span>{rec.task.icon ?? '⚡'}</span>
          <span className="truncate">{rec.task.title}</span>
        </div>
        <div className="mt-1 text-xs text-amber-500">{stars}</div>
        <div className="text-[11px] text-slate-500">
          score {rec.score.toFixed(2)}
        </div>
        {unlocksLabel && (
          <div className="mt-1 truncate text-[11px] text-slate-600">
            ▷ {unlocksLabel} 해금
          </div>
        )}
      </button>
      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
          aria-label={isPinned ? '핀 해제' : '상단 고정'}
          className={`rounded p-1 text-xs hover:bg-slate-100 ${
            isPinned ? 'text-amber-600' : 'text-slate-500'
          }`}
          title={isPinned ? '핀 해제' : '상단 고정'}
        >
          📌
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSnooze();
          }}
          aria-label="24시간 숨김"
          className="rounded p-1 text-xs text-slate-500 hover:bg-slate-100"
          title="24시간 숨김"
        >
          💤
        </button>
      </div>
    </div>
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
