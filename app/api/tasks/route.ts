import { NextResponse } from 'next/server';
import {
  createTask,
  listTasks,
  TaskCycleError,
  TaskNotFoundError,
  TaskValidationError,
  type CreateTaskInput,
} from '@/lib/tasks';
import { getCurrentUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const tasks = await listTasks(userId);
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('[tasks GET] failed:', error);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  try {
    const task = await createTask(userId, body as CreateTaskInput);
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
