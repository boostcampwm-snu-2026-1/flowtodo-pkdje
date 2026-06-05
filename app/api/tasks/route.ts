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
