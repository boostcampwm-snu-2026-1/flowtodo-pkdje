import { describe, expect, it, vi } from 'vitest';
import type { Task } from '@/lib/tasks';

// Mock mongo (lib/dag imports nothing from mongo, but mock guards transitive imports if any)
vi.mock('@/lib/mongo', () => ({ default: Promise.resolve(null) }));

import { buildGraph, applyLayout } from '@/lib/dag';

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
