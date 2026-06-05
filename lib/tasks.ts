import { Collection, ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongo';

// ---------- types ----------

export type Status = 'todo' | 'in_progress' | 'done';
export type Priority = 1 | 2 | 3 | 4 | 5;

/** DB 문서 형태 (내부) */
export type TaskDoc = {
  _id: ObjectId;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  dueDate?: Date;
  prerequisites: ObjectId[];
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
};

/** API 응답 형태 (외부) — id 는 string, 날짜는 ISO */
export type Task = {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  dueDate?: string;
  prerequisites: string[];
  icon?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  dueDate?: string; // ISO
  prerequisites?: string[];
  icon?: string;
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

// ---------- errors ----------

export class TaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskValidationError';
  }
}

export class TaskNotFoundError extends Error {
  constructor(id: string) {
    super(`task not found: ${id}`);
    this.name = 'TaskNotFoundError';
  }
}

export class TaskCycleError extends Error {
  constructor() {
    super('prerequisites would create a cycle');
    this.name = 'TaskCycleError';
  }
}

// ---------- helpers ----------

export function serializeTask(doc: TaskDoc): Task {
  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    status: doc.status,
    priority: doc.priority,
    dueDate: doc.dueDate?.toISOString(),
    prerequisites: doc.prerequisites.map((p) => p.toString()),
    icon: doc.icon,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function getCollection(): Promise<Collection<TaskDoc>> {
  const client = await clientPromise;
  return client.db().collection<TaskDoc>('tasks');
}

function toObjectId(id: string, label: string): ObjectId {
  if (!ObjectId.isValid(id)) {
    throw new TaskValidationError(`${label} is not a valid ObjectId: ${id}`);
  }
  return new ObjectId(id);
}

function validatePriority(p: unknown): Priority {
  if (p === 1 || p === 2 || p === 3 || p === 4 || p === 5) return p;
  throw new TaskValidationError(`priority must be 1-5, got: ${String(p)}`);
}

function validateStatus(s: unknown): Status {
  if (s === 'todo' || s === 'in_progress' || s === 'done') return s;
  throw new TaskValidationError(
    `status must be todo/in_progress/done, got: ${String(s)}`,
  );
}

// ---------- public DB ops ----------

export async function listTasks(): Promise<Task[]> {
  const col = await getCollection();
  const docs = await col.find({}).toArray();
  return docs.map(serializeTask);
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  if (typeof input.title !== 'string' || input.title.trim() === '') {
    throw new TaskValidationError(
      'title is required and must be non-empty string',
    );
  }

  const status =
    input.status !== undefined
      ? validateStatus(input.status)
      : ('todo' as Status);
  const priority =
    input.priority !== undefined
      ? validatePriority(input.priority)
      : (3 as Priority);
  const prereqIds = (input.prerequisites ?? []).map((p) =>
    toObjectId(p, 'prerequisite'),
  );

  const col = await getCollection();

  // verify prerequisites exist
  if (prereqIds.length > 0) {
    const existing = await col
      .find({ _id: { $in: prereqIds } }, { projection: { _id: 1 } })
      .toArray();
    if (existing.length !== prereqIds.length) {
      const found = new Set(existing.map((t) => t._id.toString()));
      const missing = prereqIds.filter((id) => !found.has(id.toString()));
      throw new TaskValidationError(
        `prerequisite not found: ${missing.map((m) => m.toString()).join(', ')}`,
      );
    }
  }

  const now = new Date();
  const doc: Omit<TaskDoc, '_id'> = {
    title: input.title.trim(),
    description: input.description,
    status,
    priority,
    dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
    prerequisites: prereqIds,
    icon: input.icon,
    createdAt: now,
    updatedAt: now,
  };
  const result = await col.insertOne(doc as TaskDoc);
  return serializeTask({ ...doc, _id: result.insertedId } as TaskDoc);
}

// updateTask, deleteTask — Task 4 에서 추가

// ---------- pure: cycle detection ----------

/**
 * 3색 DFS 로 그래프 전체에 사이클이 있는지 검사.
 * gray 상태 노드를 다시 방문하면 back edge = 사이클.
 * 그래프 외부의 prereq 참조 (dangling) 는 skip — cascade 삭제 직후 잠시 존재 가능.
 */
export function hasCycle(
  tasks: ReadonlyArray<Pick<TaskDoc, '_id' | 'prerequisites'>>,
): boolean {
  type Color = 'white' | 'gray' | 'black';
  const color = new Map<string, Color>();
  const prereqMap = new Map<string, string[]>();

  for (const t of tasks) {
    const id = t._id.toString();
    color.set(id, 'white');
    prereqMap.set(
      id,
      t.prerequisites.map((p) => p.toString()),
    );
  }

  function dfs(id: string): boolean {
    color.set(id, 'gray');
    const prereqs = prereqMap.get(id) ?? [];
    for (const p of prereqs) {
      if (!color.has(p)) continue; // dangling — skip
      const c = color.get(p);
      if (c === 'gray') return true;
      if (c === 'white' && dfs(p)) return true;
    }
    color.set(id, 'black');
    return false;
  }

  for (const t of tasks) {
    const id = t._id.toString();
    if (color.get(id) === 'white' && dfs(id)) return true;
  }
  return false;
}
