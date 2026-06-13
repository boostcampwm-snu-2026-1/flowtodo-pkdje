import { NextResponse } from 'next/server';
import {
  deleteTask,
  TaskCycleError,
  TaskNotFoundError,
  TaskValidationError,
  updateTask,
  type UpdateTaskInput,
} from '@/lib/tasks';
import { getCurrentUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function errorResponse(
  error: unknown,
  action: 'PATCH' | 'DELETE',
): NextResponse {
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
    const task = await updateTask(userId, params.id, body as UpdateTaskInput);
    return NextResponse.json({ task });
  } catch (error) {
    return errorResponse(error, 'PATCH');
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await deleteTask(userId, params.id);
    return NextResponse.json({ ok: true, cascadeFrom: result.cascadeFrom });
  } catch (error) {
    return errorResponse(error, 'DELETE');
  }
}
