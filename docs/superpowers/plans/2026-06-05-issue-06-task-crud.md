# Issue #6 — Task CRUD API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `tasks` 컬렉션에 대한 CRUD 4종 (`GET / POST /api/tasks`, `PATCH / DELETE /api/tasks/:id`) 을 추가. 서버 측 사이클 검증 + 삭제 시 다른 태스크의 `prerequisites` 에서 cascade 정리. `icon` 필드 수용. Vitest 도입 (cycle 검출 같은 pure 로직의 TDD 환경).

**Architecture:** 도메인 로직(타입, 직렬화, DB 접근, cycle 검출)은 `lib/tasks.ts` 한 곳. Route Handler 는 thin wrapper — 입력 파싱, 도메인 함수 호출, 도메인 에러를 HTTP 상태로 변환만. Cycle 검출은 순수 함수(`hasCycle`) — 입력 그래프 + 제안 변경 적용 후 white/gray/black 3색 DFS. Vitest 로 단위 테스트.

**Tech Stack:** mongodb 7.x driver · Next.js App Router Route Handlers · Vitest 1.x · TypeScript strict

**Issue:** [#6 Task CRUD API](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/6)
**Branch model:** `feature/6-task-crud → main` (트렁크 기반)

---

## File Structure

| File | Purpose |
|---|---|
| `lib/tasks.ts` | `Task` / `TaskDoc` 타입 + `serializeTask` + `getCollection()` + 5종 도메인 함수 (`listTasks`, `createTask`, `updateTask`, `deleteTask`, `hasCycle`) + 도메인 에러 클래스. 단일 책임: tasks 컬렉션 관련 모든 로직. |
| `lib/tasks.test.ts` | Vitest 단위 테스트 — `hasCycle` 전용 (순수 함수). DB 접근 함수는 통합 검증(curl) 으로 커버. |
| `vitest.config.ts` | Vitest 설정. `vite-tsconfig-paths` 로 `@/*` alias 해석. |
| `app/api/tasks/route.ts` | `GET` (목록), `POST` (생성). `force-dynamic` (DB 호출). |
| `app/api/tasks/[id]/route.ts` | `PATCH`, `DELETE`. `force-dynamic`. |
| `package.json` | `vitest`, `@vitest/coverage-v8`(선택 X), `vite-tsconfig-paths` devDeps + `test` 스크립트 추가. |

**Not creating** (out of scope):
- 별도 입력 검증 라이브러리 (zod 등) — 수동 체크로 충분, 이후 필요 시 도입.
- 인증/권한 — 단일 사용자.
- 페이지네이션 — 수백 노드 규모 가정, 한 번에 전체 fetch.
- 인덱스 정의 — 작은 단일 사용자 데이터, 인덱스 없어도 충분.

---

## Task 0: Feature 브랜치

- [ ] **Step 0.1: main 최신화 + 분기**

```bash
git checkout main && git pull origin main && git checkout -b feature/6-task-crud
```

Expected:
- `main` → 동기화됨 (이전 #5 머지 포함)
- `Switched to a new branch 'feature/6-task-crud'`

---

## Task 1: Vitest 설치 + 설정

**Files:**
- Modify: `package.json` (deps + `test` script)
- Create: `vitest.config.ts`

- [ ] **Step 1.1: 의존성 설치**

```bash
npm install -D vitest vite-tsconfig-paths
```

Expected: `added N packages...` 정상 종료.

- [ ] **Step 1.2: `vitest.config.ts` 생성**

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
```

- [ ] **Step 1.3: `package.json` 의 `scripts` 에 `test` 추가**

`package.json` 의 `scripts` 블록을 다음과 같이 변경 (다른 scripts 는 그대로 유지):

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 1.4: 빈 상태로 테스트 명령 확인**

```bash
npm test
```

Expected:
```
 No test files found, exiting with code 1
```

또는 정상 종료(빈 결과). 빈 결과로 exit 1 이 나와도 vitest 설치 자체는 검증됨. Task 3 에서 첫 테스트를 작성하면 통과로 바뀜.

- [ ] **Step 1.5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts && git commit -m "chore: set up Vitest with tsconfig paths (#6)"
```

---

## Task 2: `lib/tasks.ts` 기반 — 타입 + 직렬화 + listTasks + createTask

**Files:**
- Create: `lib/tasks.ts`

- [ ] **Step 2.1: `lib/tasks.ts` 작성**

```ts
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
  throw new TaskValidationError(`status must be todo/in_progress/done, got: ${String(s)}`);
}

// ---------- public DB ops ----------

export async function listTasks(): Promise<Task[]> {
  const col = await getCollection();
  const docs = await col.find({}).toArray();
  return docs.map(serializeTask);
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  if (typeof input.title !== 'string' || input.title.trim() === '') {
    throw new TaskValidationError('title is required and must be non-empty string');
  }

  const status = input.status !== undefined ? validateStatus(input.status) : ('todo' as Status);
  const priority = input.priority !== undefined ? validatePriority(input.priority) : (3 as Priority);
  const prereqIds = (input.prerequisites ?? []).map((p) => toObjectId(p, 'prerequisite'));

  // verify prerequisites exist
  const col = await getCollection();
  if (prereqIds.length > 0) {
    const existing = await col.find({ _id: { $in: prereqIds } }, { projection: { _id: 1 } }).toArray();
    if (existing.length !== prereqIds.length) {
      const found = new Set(existing.map((t) => t._id.toString()));
      const missing = prereqIds.filter((id) => !found.has(id.toString()));
      throw new TaskValidationError(`prerequisite not found: ${missing.map((m) => m.toString()).join(', ')}`);
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

// updateTask, deleteTask, hasCycle — Tasks 3, 4 에서 추가
```

- [ ] **Step 2.2: 타입 검사**

```bash
npm run typecheck
```

Expected: 출력 없음 / exit 0.

- [ ] **Step 2.3: Commit**

```bash
git add lib/tasks.ts && git commit -m "feat(tasks): add types, serializer, listTasks, createTask (#6)"
```

---

## Task 3: 사이클 검출 (TDD)

**Files:**
- Modify: `lib/tasks.ts` (add `hasCycle`)
- Create: `lib/tasks.test.ts`

- [ ] **Step 3.1: 실패하는 테스트 작성 — `lib/tasks.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

// Mock the mongo client — tests don't touch DB
vi.mock('@/lib/mongo', () => ({
  default: Promise.resolve(null),
}));

import { hasCycle, type TaskDoc } from '@/lib/tasks';

function mk(id: string, prereqs: string[] = []): Pick<TaskDoc, '_id' | 'prerequisites'> {
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
    expect(hasCycle([mk(A), mk(B, [A]), mk(C, [A]), mk(D, [B, C])])).toBe(false);
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
```

- [ ] **Step 3.2: 테스트 실행해서 실패 확인**

```bash
npm test
```

Expected: 모든 테스트 실패 (`hasCycle is not a function` 또는 비슷한 import 에러).

- [ ] **Step 3.3: `lib/tasks.ts` 끝에 `hasCycle` 추가**

`lib/tasks.ts` 의 맨 아래 (마지막 export 다음) 에 추가:

```ts
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
    prereqMap.set(id, t.prerequisites.map((p) => p.toString()));
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
```

- [ ] **Step 3.4: 테스트 통과 확인**

```bash
npm test
```

Expected:
```
✓ lib/tasks.test.ts (9)
  ✓ hasCycle (9)
    ✓ returns false on empty graph
    ✓ returns false on single node with no prereqs
    ✓ returns false on linear chain A→B→C
    ✓ returns false on branching DAG
    ✓ returns true on self-loop (A depends on itself)
    ✓ returns true on direct cycle A→B→A
    ✓ returns true on indirect cycle A→B→C→A
    ✓ returns false on two independent components
    ✓ ignores dangling prerequisite references (deleted task)

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

- [ ] **Step 3.5: typecheck + lint + format 검증**

```bash
npm run typecheck && npm run lint && npm run format && npm run format:check
```

Expected: 모두 통과.

- [ ] **Step 3.6: Commit**

```bash
git add lib/tasks.ts lib/tasks.test.ts && git commit -m "feat(tasks): add hasCycle with white/gray/black DFS + tests (#6)"
```

---

## Task 4: `updateTask` + `deleteTask`

**Files:**
- Modify: `lib/tasks.ts`

- [ ] **Step 4.1: `lib/tasks.ts` 의 `createTask` 다음에 `updateTask` 추가**

```ts
export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  const _id = toObjectId(id, 'id');
  const col = await getCollection();

  const existing = await col.findOne({ _id });
  if (!existing) throw new TaskNotFoundError(id);

  // build $set patch with validated fields
  const set: Partial<TaskDoc> = { updatedAt: new Date() };

  if (input.title !== undefined) {
    if (typeof input.title !== 'string' || input.title.trim() === '') {
      throw new TaskValidationError('title must be a non-empty string');
    }
    set.title = input.title.trim();
  }
  if (input.description !== undefined) set.description = input.description;
  if (input.status !== undefined) set.status = validateStatus(input.status);
  if (input.priority !== undefined) set.priority = validatePriority(input.priority);
  if (input.dueDate !== undefined) {
    set.dueDate = input.dueDate ? new Date(input.dueDate) : undefined;
  }
  if (input.icon !== undefined) set.icon = input.icon;

  let newPrereqs: ObjectId[] | undefined;
  if (input.prerequisites !== undefined) {
    newPrereqs = input.prerequisites.map((p) => toObjectId(p, 'prerequisite'));

    // verify all referenced prereqs exist (other than self)
    const others = newPrereqs.filter((p) => !p.equals(_id));
    if (others.length > 0) {
      const existingPrereqs = await col
        .find({ _id: { $in: others } }, { projection: { _id: 1 } })
        .toArray();
      if (existingPrereqs.length !== others.length) {
        throw new TaskValidationError('one or more prerequisites do not exist');
      }
    }

    // cycle check on proposed state
    const allTasks = await col.find({}, { projection: { _id: 1, prerequisites: 1 } }).toArray();
    const proposed = allTasks.map((t) =>
      t._id.equals(_id) ? { _id: t._id, prerequisites: newPrereqs! } : t,
    );
    if (hasCycle(proposed)) throw new TaskCycleError();

    set.prerequisites = newPrereqs;
  }

  const result = await col.findOneAndUpdate({ _id }, { $set: set }, { returnDocument: 'after' });
  if (!result) throw new TaskNotFoundError(id);
  return serializeTask(result);
}
```

- [ ] **Step 4.2: `deleteTask` 추가 (그 다음)**

```ts
export async function deleteTask(id: string): Promise<{ deleted: boolean; cascadeFrom: number }> {
  const _id = toObjectId(id, 'id');
  const col = await getCollection();

  const existing = await col.findOne({ _id }, { projection: { _id: 1 } });
  if (!existing) throw new TaskNotFoundError(id);

  // cascade: remove this id from any other task's prerequisites
  const cascade = await col.updateMany(
    { prerequisites: _id },
    { $pull: { prerequisites: _id }, $set: { updatedAt: new Date() } },
  );

  await col.deleteOne({ _id });
  return { deleted: true, cascadeFrom: cascade.modifiedCount };
}
```

- [ ] **Step 4.3: 타입 검사**

```bash
npm run typecheck
```

Expected: 출력 없음.

- [ ] **Step 4.4: Commit**

```bash
git add lib/tasks.ts && git commit -m "feat(tasks): add updateTask (cycle check) + deleteTask (cascade) (#6)"
```

---

## Task 5: `GET /api/tasks` + `POST /api/tasks`

**Files:**
- Create: `app/api/tasks/route.ts`

- [ ] **Step 5.1: `app/api/tasks/route.ts` 작성**

```ts
import { NextResponse } from 'next/server';
import {
  createTask,
  listTasks,
  TaskCycleError,
  TaskNotFoundError,
  TaskValidationError,
} from '@/lib/tasks';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tasks = await listTasks();
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('[tasks GET] failed:', error);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  try {
    const task = await createTask(body as Parameters<typeof createTask>[0]);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    if (error instanceof TaskValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof TaskCycleError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof TaskNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('[tasks POST] failed:', error);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 5.2: 검증**

```bash
npm run typecheck && npm run lint && npm run format && npm run format:check
```

Expected: 모두 통과.

- [ ] **Step 5.3: Commit**

```bash
git add app/api/tasks/route.ts && git commit -m "feat(api): add GET/POST /api/tasks (#6)"
```

---

## Task 6: `PATCH` + `DELETE /api/tasks/[id]`

**Files:**
- Create: `app/api/tasks/[id]/route.ts`

- [ ] **Step 6.1: `app/api/tasks/[id]/route.ts` 작성**

```ts
import { NextResponse } from 'next/server';
import {
  deleteTask,
  TaskCycleError,
  TaskNotFoundError,
  TaskValidationError,
  updateTask,
} from '@/lib/tasks';

export const dynamic = 'force-dynamic';

function errorResponse(error: unknown, action: 'PATCH' | 'DELETE'): NextResponse {
  if (error instanceof TaskValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof TaskCycleError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof TaskNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  console.error(`[tasks ${action}] failed:`, error);
  return NextResponse.json({ error: 'internal error' }, { status: 500 });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  try {
    const task = await updateTask(params.id, body as Parameters<typeof updateTask>[1]);
    return NextResponse.json({ task });
  } catch (error) {
    return errorResponse(error, 'PATCH');
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const result = await deleteTask(params.id);
    return NextResponse.json({ ok: true, cascadeFrom: result.cascadeFrom });
  } catch (error) {
    return errorResponse(error, 'DELETE');
  }
}
```

- [ ] **Step 6.2: 검증**

```bash
npm run typecheck && npm run lint && npm run format && npm run format:check && npm test
```

Expected: 모두 통과.

- [ ] **Step 6.3: Commit**

```bash
git add app/api/tasks/[id]/route.ts && git commit -m "feat(api): add PATCH/DELETE /api/tasks/[id] (#6)"
```

---

## Task 7: 통합 Smoke (curl 시나리오)

코드 수정 없음. 전체 흐름이 실제로 동작하는지 검증.

- [ ] **Step 7.1: dev 서버 실행 (background) + production build 확인**

(이 단계는 사용자가 직접 실행해도, Claude 가 background 로 실행해도 됨.)

```bash
npm run build
```

Expected (마지막 부분):
```
Route (app)                              Size     First Load JS
┌ ○ /                                    ...
├ ○ /_not-found                          ...
├ ƒ /api/health                          ...
├ ƒ /api/tasks                           ...
└ ƒ /api/tasks/[id]                      ...
```

모든 신규 라우트가 `ƒ (Dynamic)` 로 등록되었는지 확인.

- [ ] **Step 7.2: dev 서버 띄우고 curl 시나리오**

```bash
npm run dev  # 별도 터미널 또는 background
```

다음 curl 들을 순서대로 실행:

**(a) 빈 목록**
```bash
curl -s http://localhost:3000/api/tasks
```
Expected: `{"tasks":[]}`

**(b) 첫 태스크 생성 (prereq 없음)**
```bash
curl -s -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"기획","icon":"🎯"}'
```
Expected: HTTP 201. 응답 JSON 의 `task.id` 값을 변수에 저장 (예: `TASK1=...`).

**(c) 둘째 태스크 — (b) 를 prereq 로**
```bash
curl -s -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d "{\"title\":\"디자인\",\"priority\":5,\"prerequisites\":[\"$TASK1\"]}"
```
Expected: HTTP 201, `task.prerequisites=[TASK1]`. `task.id` 저장 → `TASK2`.

**(d) 목록 조회**
```bash
curl -s http://localhost:3000/api/tasks | jq
```
Expected: tasks 배열에 2개.

**(e) PATCH — 둘째 태스크의 status 변경**
```bash
curl -s -X PATCH http://localhost:3000/api/tasks/$TASK2 \
  -H 'Content-Type: application/json' \
  -d '{"status":"in_progress"}'
```
Expected: HTTP 200, `task.status="in_progress"`, `task.updatedAt` 갱신.

**(f) 사이클 시도 — 첫 태스크의 prereq 에 둘째를 넣기**
```bash
curl -s -i -X PATCH http://localhost:3000/api/tasks/$TASK1 \
  -H 'Content-Type: application/json' \
  -d "{\"prerequisites\":[\"$TASK2\"]}"
```
Expected: `HTTP/1.1 409 Conflict`, body: `{"error":"prerequisites would create a cycle"}`.

**(g) 자기 자신 prereq 시도**
```bash
curl -s -i -X PATCH http://localhost:3000/api/tasks/$TASK1 \
  -H 'Content-Type: application/json' \
  -d "{\"prerequisites\":[\"$TASK1\"]}"
```
Expected: HTTP 409 (self-loop = cycle).

**(h) DELETE — 첫 태스크 삭제 (둘째에서 cascade 정리)**
```bash
curl -s -X DELETE http://localhost:3000/api/tasks/$TASK1
```
Expected: `{"ok":true,"cascadeFrom":1}`.

**(i) 둘째 태스크 확인 — prereq 가 비어있어야 함**
```bash
curl -s http://localhost:3000/api/tasks | jq '.tasks[0].prerequisites'
```
Expected: `[]`.

**(j) 존재하지 않는 id PATCH**
```bash
curl -s -i -X PATCH http://localhost:3000/api/tasks/000000000000000000000000 \
  -H 'Content-Type: application/json' \
  -d '{"title":"x"}'
```
Expected: HTTP 404.

**(k) 잘못된 priority 입력**
```bash
curl -s -i -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"테스트","priority":99}'
```
Expected: HTTP 400.

- [ ] **Step 7.3: dev 서버 종료, 정리**

`Ctrl+C` 또는 background process kill.

```bash
git status --short
```
Expected: 빈 출력.

---

## Task 8: Push + PR + 머지

- [ ] **Step 8.1: 계획 문서 commit + push**

```bash
git add docs/superpowers/plans/2026-06-05-issue-06-task-crud.md && \
git commit -m "docs: add implementation plan for #6 Task CRUD API" && \
git push -u origin feature/6-task-crud
```

- [ ] **Step 8.2: PR 생성**

```bash
gh pr create --repo boostcampwm-snu-2026-1/flowtodo-pkdje \
  --base main --head feature/6-task-crud \
  --title "feat: Task CRUD API with cycle detection + cascade delete (#6)" \
  --body "$(cat <<'EOF'
Closes #6.

## 변경
- **`lib/tasks.ts`** — 도메인 모듈
  - 타입: `TaskDoc` (DB), `Task` (API), `CreateTaskInput`, `UpdateTaskInput`
  - 도메인 에러: `TaskValidationError` (400), `TaskNotFoundError` (404), `TaskCycleError` (409)
  - DB ops: `listTasks`, `createTask`, `updateTask`, `deleteTask`
  - **`hasCycle`** — 순수 함수, white/gray/black 3색 DFS, dangling 참조는 skip
  - cascade delete: 삭제 시 다른 태스크의 `prerequisites` 에서 해당 id `$pull`
- **`lib/tasks.test.ts`** — 9개 단위 테스트 (cycle detection 전체 케이스: empty, single, linear, branching, self-loop, direct cycle, indirect cycle, independent components, dangling refs)
- **API routes** (모두 `force-dynamic`)
  - `GET /api/tasks` → `{ tasks }`
  - `POST /api/tasks` → 201 + `{ task }` (title 필수, priority 기본 3, status 기본 todo)
  - `PATCH /api/tasks/:id` → 200 + `{ task }` (부분 수정, prereq 변경 시 cycle 검증)
  - `DELETE /api/tasks/:id` → `{ ok: true, cascadeFrom: N }` (다른 태스크의 prereq 에서 정리된 개수)
- **Vitest 도입**: `vitest.config.ts` + `vite-tsconfig-paths` + `test` script.

## 검증
- [x] `npm run typecheck` 통과
- [x] `npm run lint` 통과
- [x] `npm run format:check` 통과
- [x] `npm test` — 9/9 통과 (hasCycle 전 케이스)
- [x] `npm run build` — `/api/tasks`, `/api/tasks/[id]` 둘 다 `ƒ (Dynamic)` 등록
- [x] curl 시나리오 (a)~(k) — 정상 / cycle 거부 (409) / 자기참조 거부 / cascade 동작 / 404 / 400 모두 확인

## 후속
- [#7 메인 페이지 레이아웃](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/7)
- [#8 React Flow 기반 DAG 렌더](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/8) — 본 API 가 데이터 소스
EOF
)"
```

- [ ] **Step 8.3: 머지 + 로컬 정리**

PR URL 의 셀프 리뷰 → 머지:
```bash
gh pr merge <PR번호> --repo boostcampwm-snu-2026-1/flowtodo-pkdje --squash
# y (로컬 브랜치 삭제)
git checkout main && git pull origin main
```

---

## Definition of Done

1. 이슈 [#6 AC](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/6) 6개 다 충족:
   - `GET /api/tasks` (Task 5) ✓
   - `POST /api/tasks` (Task 5) ✓
   - `PATCH /api/tasks/:id` (Task 6) ✓
   - `DELETE /api/tasks/:id` + cascade (Task 6 + Task 4 cascade 로직) ✓
   - 사이클 검증 DFS (Task 3 + Task 4) ✓
   - `icon?: string` 필드 수용 (Task 2 type + createTask + Task 4 updateTask) ✓
2. Vitest 셋업 + cycle 단위 테스트 통과 (Task 3) ✓
3. typecheck / lint / format / build 모두 통과 ✓
4. PR 머지 후 main 반영.

---

## After Merge

- 이슈 #6 자동 close.
- 다음 plan: [#7 메인 페이지 레이아웃](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/7) — 헤더 + 분할 뷰 골격.
