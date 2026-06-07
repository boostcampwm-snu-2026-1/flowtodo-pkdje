import type { Task } from '@/lib/tasks';

export type Weights = { wPriority: number; wImpact: number };
export const DEFAULT_WEIGHTS: Weights = { wPriority: 0.6, wImpact: 0.4 };

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

export class RecommenderCycleError extends Error {
  constructor(message = 'graph contains a cycle') {
    super(message);
    this.name = 'RecommenderCycleError';
  }
}

// ---------- public functions (구현은 후속 task) ----------

export function computeReadySet(tasks: Task[]): Task[] {
  const statusById = new Map(tasks.map((t) => [t.id, t.status]));
  return tasks.filter((t) => {
    if (t.status !== 'todo') return false;
    for (const p of t.prerequisites) {
      const s = statusById.get(p);
      if (s === undefined) continue; // dangling = 완료로 간주
      if (s !== 'done') return false;
    }
    return true;
  });
}

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

export function computeScore(
  task: Task,
  impact: number,
  maxImpact: number,
  weights: Weights = DEFAULT_WEIGHTS,
): { score: number; breakdown: Recommendation['breakdown'] } {
  // priority 1 이 가장 높음 → (6 - priority) / 5 로 정규화
  // priority=1 → 1.0, priority=5 → 0.2
  const priorityComponent = weights.wPriority * ((6 - task.priority) / 5);
  const impactComponent =
    maxImpact === 0 ? 0 : weights.wImpact * (impact / maxImpact);
  return {
    score: priorityComponent + impactComponent,
    breakdown: { priorityComponent, impactComponent },
  };
}

function detectCycle(tasks: Task[]): boolean {
  type Color = 'white' | 'gray' | 'black';
  const color = new Map<string, Color>();
  const prereqMap = new Map<string, string[]>();

  for (const t of tasks) {
    color.set(t.id, 'white');
    prereqMap.set(t.id, t.prerequisites);
  }

  function dfs(id: string): boolean {
    color.set(id, 'gray');
    for (const p of prereqMap.get(id) ?? []) {
      if (!color.has(p)) continue; // dangling
      const c = color.get(p);
      if (c === 'gray') return true;
      if (c === 'white' && dfs(p)) return true;
    }
    color.set(id, 'black');
    return false;
  }

  for (const t of tasks) {
    if (color.get(t.id) === 'white' && dfs(t.id)) return true;
  }
  return false;
}

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
    // priority 1 이 가장 높음 → ASC 정렬
    if (a.task.priority !== b.task.priority) {
      return a.task.priority - b.task.priority;
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
