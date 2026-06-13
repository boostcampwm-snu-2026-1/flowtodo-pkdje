import { describe, expect, it, vi } from 'vitest';
import type { Task } from '@/lib/tasks';

vi.mock('@/lib/mongo', () => ({ default: Promise.resolve(null) }));

import {
  connectedComponents,
  detectUnlocks,
  questLineProgress,
  rewardText,
} from '@/lib/quest';

function mkTask(
  id: string,
  prereqs: string[] = [],
  extra: Partial<Task> = {},
): Task {
  return {
    id,
    userId: 'u1',
    title: `task-${id}`,
    status: 'todo',
    priority: 3,
    prerequisites: prereqs,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

describe('connectedComponents', () => {
  it('returns empty for empty input', () => {
    expect(connectedComponents([])).toEqual([]);
  });

  it('single isolated task is its own component', () => {
    const comps = connectedComponents([mkTask('a')]);
    expect(comps).toEqual([{ id: 'a', taskIds: ['a'] }]);
  });

  it('linear chain A→B→C is one component', () => {
    const comps = connectedComponents([
      mkTask('a'),
      mkTask('b', ['a']),
      mkTask('c', ['b']),
    ]);
    expect(comps).toHaveLength(1);
    expect(comps[0].taskIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('branching graph is one component', () => {
    const comps = connectedComponents([
      mkTask('a'),
      mkTask('b', ['a']),
      mkTask('c', ['a']),
      mkTask('d', ['b', 'c']),
    ]);
    expect(comps).toHaveLength(1);
    expect(comps[0].taskIds.sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('two independent components are detected', () => {
    const comps = connectedComponents([
      mkTask('a'),
      mkTask('b', ['a']),
      mkTask('c'),
      mkTask('d', ['c']),
    ]);
    expect(comps).toHaveLength(2);
    const ids = comps.map((c) => c.id).sort();
    expect(ids).toEqual(['a', 'c']);
  });
});

describe('questLineProgress', () => {
  it('returns 0/0 for missing component', () => {
    expect(questLineProgress('ghost', [], [])).toEqual({ done: 0, total: 0 });
  });

  it('counts done tasks in component', () => {
    const tasks = [
      mkTask('a', [], { status: 'done' }),
      mkTask('b', ['a']),
      mkTask('c', ['b']),
    ];
    const comps = connectedComponents(tasks);
    expect(questLineProgress(comps[0].id, comps, tasks)).toEqual({
      done: 1,
      total: 3,
    });
  });

  it('counts all done', () => {
    const tasks = [
      mkTask('a', [], { status: 'done' }),
      mkTask('b', ['a'], { status: 'done' }),
    ];
    const comps = connectedComponents(tasks);
    expect(questLineProgress(comps[0].id, comps, tasks)).toEqual({
      done: 2,
      total: 2,
    });
  });
});

describe('rewardText', () => {
  it('one downstream: "<title> 해금"', () => {
    const a = mkTask('a');
    const b = mkTask('b', ['a'], { title: 'Beta' });
    expect(rewardText(a, [a, b])).toBe('Beta 해금');
  });

  it('two downstream: "<t1>, <t2> 해금"', () => {
    const a = mkTask('a');
    const b = mkTask('b', ['a'], { title: 'B' });
    const c = mkTask('c', ['a'], { title: 'C' });
    expect(rewardText(a, [a, b, c])).toBe('B, C 해금');
  });

  it('three downstream: includes all three', () => {
    const a = mkTask('a');
    const b = mkTask('b', ['a'], { title: 'B' });
    const c = mkTask('c', ['a'], { title: 'C' });
    const d = mkTask('d', ['a'], { title: 'D' });
    expect(rewardText(a, [a, b, c, d])).toBe('B, C, D 해금');
  });

  it('four+ downstream: count format', () => {
    const a = mkTask('a');
    const dependents = ['b', 'c', 'd', 'e'].map((id) => mkTask(id, ['a']));
    expect(rewardText(a, [a, ...dependents])).toBe('4개 작업 해금');
  });

  it('no downstream + component size > 1: 메인 퀘스트 X/Y 완료', () => {
    const a = mkTask('a', [], { status: 'done' });
    const b = mkTask('b', ['a']);
    expect(rewardText(b, [a, b])).toBe('메인 퀘스트 1/2 완료');
  });

  it('no downstream + component size == 1: 사이드 퀘스트 완료', () => {
    const a = mkTask('a');
    expect(rewardText(a, [a])).toBe('사이드 퀘스트 완료');
  });
});

describe('detectUnlocks', () => {
  it('no change → empty', () => {
    const prev = [mkTask('a'), mkTask('b', ['a'])];
    expect(detectUnlocks(prev, prev)).toEqual([]);
  });

  it('a becomes done → b unlocks', () => {
    const prev = [mkTask('a'), mkTask('b', ['a'])];
    const next = [mkTask('a', [], { status: 'done' }), mkTask('b', ['a'])];
    expect(detectUnlocks(prev, next)).toEqual(['b']);
  });

  it('new task added that is ready → reported', () => {
    const prev = [mkTask('a')];
    const next = [mkTask('a'), mkTask('b')];
    expect(detectUnlocks(prev, next)).toEqual(['b']);
  });

  it('already-ready tasks are not reported', () => {
    const prev = [mkTask('a')];
    const next = [mkTask('a'), mkTask('b', [], { status: 'in_progress' })];
    // a was already ready, b is in_progress (not ready) → no new unlock
    expect(detectUnlocks(prev, next)).toEqual([]);
  });
});
