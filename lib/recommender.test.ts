import { describe, expect, it, vi } from 'vitest';
import type { Task } from '@/lib/tasks';

// mongo guard (lib/recommender 는 import 안 하지만 transitive 안전)
vi.mock('@/lib/mongo', () => ({ default: Promise.resolve(null) }));

import {
  computeImpact,
  computeImpactSet,
  computeReadySet,
  computeRecommendations,
  computeScore,
  RecommenderCycleError,
  wouldCreateCycle,
} from '@/lib/recommender';

function mkTask(
  id: string,
  prereqs: string[] = [],
  extra: Partial<Task> = {},
): Task {
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

describe('computeReadySet', () => {
  it('returns empty for empty input', () => {
    expect(computeReadySet([])).toEqual([]);
  });

  it('returns single todo with no prereqs', () => {
    const ready = computeReadySet([mkTask('a')]);
    expect(ready.map((t) => t.id)).toEqual(['a']);
  });

  it('excludes task whose prereq is still todo', () => {
    const ready = computeReadySet([mkTask('a', ['b']), mkTask('b')]);
    expect(ready.map((t) => t.id).sort()).toEqual(['b']);
  });

  it('includes task when its prereq is done', () => {
    const ready = computeReadySet([
      mkTask('a', ['b']),
      mkTask('b', [], { status: 'done' }),
    ]);
    expect(ready.map((t) => t.id)).toEqual(['a']);
  });

  it('excludes in_progress and done from ready', () => {
    const ready = computeReadySet([
      mkTask('a'),
      mkTask('b', [], { status: 'in_progress' }),
      mkTask('c', [], { status: 'done' }),
    ]);
    expect(ready.map((t) => t.id)).toEqual(['a']);
  });
});

describe('computeImpact', () => {
  it('returns empty map for empty input', () => {
    expect(computeImpact([]).size).toBe(0);
  });

  it('returns 0 for single task with no prereqs', () => {
    const m = computeImpact([mkTask('a')]);
    expect(m.get('a')).toBe(0);
  });

  it('linear chain A→B→C: A=2, B=1, C=0', () => {
    const m = computeImpact([
      mkTask('a'),
      mkTask('b', ['a']),
      mkTask('c', ['b']),
    ]);
    expect(m.get('a')).toBe(2);
    expect(m.get('b')).toBe(1);
    expect(m.get('c')).toBe(0);
  });

  it('branching A→B, A→C: A=2, B=0, C=0', () => {
    const m = computeImpact([
      mkTask('a'),
      mkTask('b', ['a']),
      mkTask('c', ['a']),
    ]);
    expect(m.get('a')).toBe(2);
    expect(m.get('b')).toBe(0);
    expect(m.get('c')).toBe(0);
  });

  it('diamond A→B, A→C, B→D, C→D: A=3 (deduped via Set)', () => {
    const m = computeImpact([
      mkTask('a'),
      mkTask('b', ['a']),
      mkTask('c', ['a']),
      mkTask('d', ['b', 'c']),
    ]);
    expect(m.get('a')).toBe(3);
    expect(m.get('b')).toBe(1);
    expect(m.get('c')).toBe(1);
    expect(m.get('d')).toBe(0);
  });

  it('diamond with C done: done not counted in impact', () => {
    const m = computeImpact([
      mkTask('a'),
      mkTask('b', ['a']),
      mkTask('c', ['a'], { status: 'done' }),
      mkTask('d', ['b', 'c']),
    ]);
    // A 의 다운스트림 = {B, C(done), D}. done 인 C 만 제외 → {B, D} = 2
    expect(m.get('a')).toBe(2);
    expect(m.get('b')).toBe(1); // D
    expect(m.get('c')).toBe(1); // D
    expect(m.get('d')).toBe(0);
  });

  it('independent components A→B, C→D: A=1, B=0, C=1, D=0', () => {
    const m = computeImpact([
      mkTask('a'),
      mkTask('b', ['a']),
      mkTask('c'),
      mkTask('d', ['c']),
    ]);
    expect(m.get('a')).toBe(1);
    expect(m.get('b')).toBe(0);
    expect(m.get('c')).toBe(1);
    expect(m.get('d')).toBe(0);
  });

  it('dangling prereq: ignored, impact stays consistent', () => {
    // A 의 prereq=[ghost] 인데 ghost 는 tasks 에 없음.
    const m = computeImpact([mkTask('a', ['ghost'])]);
    expect(m.get('a')).toBe(0);
  });
});

describe('computeScore', () => {
  it('priority=1 (highest), impact=4, maxImpact=4 → score=1.0', () => {
    const task = mkTask('a', [], { priority: 1 });
    const { score, breakdown } = computeScore(task, 4, 4);
    expect(score).toBeCloseTo(1.0, 5);
    expect(breakdown.priorityComponent).toBeCloseTo(0.6, 5);
    expect(breakdown.impactComponent).toBeCloseTo(0.4, 5);
  });

  it('priority=5 (lowest), impact=4, maxImpact=4 → score=0.52', () => {
    const task = mkTask('a', [], { priority: 5 });
    const { score, breakdown } = computeScore(task, 4, 4);
    // w_p · (6-5)/5 + w_i · 1 = 0.6·0.2 + 0.4 = 0.12 + 0.4 = 0.52
    expect(score).toBeCloseTo(0.52, 5);
    expect(breakdown.priorityComponent).toBeCloseTo(0.12, 5);
    expect(breakdown.impactComponent).toBeCloseTo(0.4, 5);
  });

  it('priority=3 (middle), impact=0, maxImpact=4 → score=0.36', () => {
    const task = mkTask('a', [], { priority: 3 });
    const { score, breakdown } = computeScore(task, 0, 4);
    // w_p · (6-3)/5 = 0.6 · 0.6 = 0.36 (priority=3 은 중간이라 반전 전후 동일)
    expect(score).toBeCloseTo(0.36, 5);
    expect(breakdown.priorityComponent).toBeCloseTo(0.36, 5);
    expect(breakdown.impactComponent).toBeCloseTo(0, 5);
  });

  it('maxImpact=0 → impactComponent=0, score=priorityComponent', () => {
    const task = mkTask('a', [], { priority: 2 });
    const { score, breakdown } = computeScore(task, 0, 0);
    // w_p · (6-2)/5 = 0.6 · 0.8 = 0.48
    expect(score).toBeCloseTo(0.48, 5);
    expect(breakdown.priorityComponent).toBeCloseTo(0.48, 5);
    expect(breakdown.impactComponent).toBe(0);
  });
});

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

describe('computeRecommendations', () => {
  it('throws RecommenderCycleError on cyclic input', () => {
    const tasks = [mkTask('a', ['b']), mkTask('b', ['a'])];
    expect(() => computeRecommendations(tasks)).toThrow(RecommenderCycleError);
  });

  it('returns empty for empty input', () => {
    expect(computeRecommendations([])).toEqual([]);
  });

  it('tie-break: same score, same priority → earlier createdAt first', () => {
    // 둘 다 leaf, priority=3 → maxImpact=0 → 점수 동일.
    // createdAt 빠른 게 먼저.
    const tasks = [
      mkTask('a', [], { createdAt: '2026-02-01T00:00:00.000Z' }),
      mkTask('b', [], { createdAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const recs = computeRecommendations(tasks);
    expect(recs.map((r) => r.task.id)).toEqual(['b', 'a']);
  });

  it('end-to-end diamond with one done: ordering reflects ready+score', () => {
    // 다이아몬드: A→B, A→C, B→D, C→D. A 가 done. 나머지 todo.
    // ready = B, C (A done 이므로). D 는 B,C 가 todo 라서 아직 ready 아님.
    // impact: A=3 (B,C,D), B=1 (D), C=1 (D), D=0
    // maxImpact=3. ready 의 score (priority 1 = 가장 높음):
    //   B (priority=3): 0.6·(6-3)/5 + 0.4·(1/3) = 0.36 + 0.1333 = 0.4933
    //   C (priority=4): 0.6·(6-4)/5 + 0.4·(1/3) = 0.24 + 0.1333 = 0.3733
    // → B 가 1등, C 가 2등.
    const tasks = [
      mkTask('a', [], { status: 'done', priority: 3 }),
      mkTask('b', ['a'], { priority: 3 }),
      mkTask('c', ['a'], { priority: 4 }),
      mkTask('d', ['b', 'c'], { priority: 5 }),
    ];
    const recs = computeRecommendations(tasks);
    expect(recs.map((r) => r.task.id)).toEqual(['b', 'c']);
    expect(recs[0].impact).toBe(1);
    expect(recs[0].score).toBeGreaterThan(recs[1].score);
    expect(recs[0].unlocks).toEqual(['d']);
    expect(recs[1].unlocks).toEqual(['d']);
  });
});

describe('wouldCreateCycle', () => {
  it('self-loop A→A is a cycle', () => {
    expect(wouldCreateCycle([mkTask('a')], 'a', 'a')).toBe(true);
  });

  it('A→B in independent graph is not a cycle', () => {
    expect(wouldCreateCycle([mkTask('a'), mkTask('b')], 'a', 'b')).toBe(false);
  });

  it('A→B when A.prereq already includes B → would create cycle', () => {
    // A.prereq=[B] 이미 있음 (즉 B→A 엣지). 새로 A→B 추가하면 사이클.
    const tasks = [mkTask('a', ['b']), mkTask('b')];
    expect(wouldCreateCycle(tasks, 'a', 'b')).toBe(true);
  });

  it('indirect cycle: A→B→C chain, adding C→A creates cycle', () => {
    // 의존성 방향: A 가 시작, B 는 A 필요, C 는 B 필요.
    // C→A 엣지 = A.prereq 에 C 추가 → A 가 C 에 의존, C 는 B 경유로 A 에 의존 → 사이클.
    const tasks = [mkTask('a'), mkTask('b', ['a']), mkTask('c', ['b'])];
    expect(wouldCreateCycle(tasks, 'c', 'a')).toBe(true);
  });
});
