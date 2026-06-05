import { describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

// Mock the mongo client — tests don't touch DB
vi.mock('@/lib/mongo', () => ({
  default: Promise.resolve(null),
}));

import { hasCycle, type TaskDoc } from '@/lib/tasks';

function mk(
  id: string,
  prereqs: string[] = [],
): Pick<TaskDoc, '_id' | 'prerequisites'> {
  return {
    _id: new ObjectId(id),
    prerequisites: prereqs.map((p) => new ObjectId(p)),
  };
}

// stable ObjectIds for predictable tests (24 hex chars each)
const A = '000000000000000000000001';
const B = '000000000000000000000002';
const C = '000000000000000000000003';
const D = '000000000000000000000004';

describe('hasCycle', () => {
  it('returns false on empty graph', () => {
    expect(hasCycle([])).toBe(false);
  });

  it('returns false on single node with no prereqs', () => {
    expect(hasCycle([mk(A)])).toBe(false);
  });

  it('returns false on linear chain A→B→C', () => {
    // C depends on B, B depends on A
    expect(hasCycle([mk(A), mk(B, [A]), mk(C, [B])])).toBe(false);
  });

  it('returns false on branching DAG', () => {
    // D depends on B and C, both of which depend on A
    expect(hasCycle([mk(A), mk(B, [A]), mk(C, [A]), mk(D, [B, C])])).toBe(
      false,
    );
  });

  it('returns true on self-loop (A depends on itself)', () => {
    expect(hasCycle([mk(A, [A])])).toBe(true);
  });

  it('returns true on direct cycle A→B→A', () => {
    // A depends on B, B depends on A
    expect(hasCycle([mk(A, [B]), mk(B, [A])])).toBe(true);
  });

  it('returns true on indirect cycle A→B→C→A', () => {
    expect(hasCycle([mk(A, [C]), mk(B, [A]), mk(C, [B])])).toBe(true);
  });

  it('returns false on two independent components', () => {
    expect(hasCycle([mk(A), mk(B, [A]), mk(C), mk(D, [C])])).toBe(false);
  });

  it('ignores dangling prerequisite references (deleted task)', () => {
    // A references B which doesn't exist in the graph
    expect(hasCycle([mk(A, [B])])).toBe(false);
  });
});
