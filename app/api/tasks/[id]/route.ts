import { NextResponse } from 'next/server';
import {
  deleteTask,
  TaskCycleError,
  TaskNotFoundError,
  TaskValidationError,
  updateTask,
} from '@/lib/tasks';

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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  try {
    const task = await updateTask(
      params.id,
      body as Parameters<typeof updateTask>[1],
    );
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
