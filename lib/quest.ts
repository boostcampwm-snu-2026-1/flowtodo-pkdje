import type { Task } from '@/lib/tasks';

export type Component = { id: string; taskIds: string[] };

/**
 * prereq 관계를 양방향 그래프로 보고 BFS 로 연결 컴포넌트를 찾는다.
 * dangling prereq (tasks 에 없는 id) 는 무시.
 * 결과는 task id 사전순. Component.id = 정렬된 첫 taskId.
 */
export function connectedComponents(tasks: Task[]): Component[] {
  const idSet = new Set(tasks.map((t) => t.id));
  const adj = new Map<string, Set<string>>();
  for (const t of tasks) adj.set(t.id, new Set());
  for (const t of tasks) {
    for (const p of t.prerequisites) {
      if (!idSet.has(p)) continue;
      adj.get(t.id)!.add(p);
      adj.get(p)!.add(t.id);
    }
  }

  const visited = new Set<string>();
  const components: Component[] = [];
  for (const t of tasks) {
    if (visited.has(t.id)) continue;
    const queue = [t.id];
    const members: string[] = [];
    visited.add(t.id);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      members.push(cur);
      for (const next of adj.get(cur) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    members.sort();
    components.push({ id: members[0], taskIds: members });
  }
  components.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return components;
}

/**
 * 특정 컴포넌트의 done/total 카운트. componentId 가 없으면 {done:0,total:0}.
 */
export function questLineProgress(
  componentId: string,
  components: Component[],
  tasks: Task[],
): { done: number; total: number } {
  const comp = components.find((c) => c.id === componentId);
  if (!comp) return { done: 0, total: 0 };
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  let done = 0;
  let total = 0;
  for (const id of comp.taskIds) {
    const t = taskById.get(id);
    if (!t) continue;
    total += 1;
    if (t.status === 'done') done += 1;
  }
  return { done, total };
}

/**
 * spec 04 §4.3 의 6가지 케이스 분기.
 * 직속 후속 = 이 task 를 prereq 로 가진 task 들.
 */
export function rewardText(task: Task, tasks: Task[]): string {
  const downstream = tasks.filter((t) => t.prerequisites.includes(task.id));

  if (downstream.length === 1) return `${downstream[0].title} 해금`;
  if (downstream.length === 2) {
    return `${downstream[0].title}, ${downstream[1].title} 해금`;
  }
  if (downstream.length === 3) {
    return `${downstream[0].title}, ${downstream[1].title}, ${downstream[2].title} 해금`;
  }
  if (downstream.length >= 4) return `${downstream.length}개 작업 해금`;

  // downstream === 0
  const components = connectedComponents(tasks);
  const myComp = components.find((c) => c.taskIds.includes(task.id));
  if (!myComp || myComp.taskIds.length === 1) return '사이드 퀘스트 완료';
  const { done, total } = questLineProgress(myComp.id, components, tasks);
  return `메인 퀘스트 ${done}/${total} 완료`;
}

/**
 * prev/next 두 상태 비교: 이전에는 막혀 있었는데 (ready 아님) 지금은 ready 인 task id.
 * ready: status === 'todo' && all prereqs done.
 */
export function detectUnlocks(prev: Task[], next: Task[]): string[] {
  const prevReady = new Set(readyIds(prev));
  const nextReady = readyIds(next);
  return nextReady.filter((id) => !prevReady.has(id));
}

function readyIds(tasks: Task[]): string[] {
  const map = new Map(tasks.map((t) => [t.id, t]));
  const ready: string[] = [];
  for (const t of tasks) {
    if (t.status !== 'todo') continue;
    let blocked = false;
    for (const p of t.prerequisites) {
      const pt = map.get(p);
      if (pt && pt.status !== 'done') {
        blocked = true;
        break;
      }
    }
    if (!blocked) ready.push(t.id);
  }
  return ready;
}
