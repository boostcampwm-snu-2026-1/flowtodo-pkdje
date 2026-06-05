import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongo';

export async function GET() {
  try {
    const client = await clientPromise;
    await client.db().admin().ping();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[health] db ping failed:', error);
    return NextResponse.json(
      { ok: false, error: 'database connection failed' },
      { status: 503 },
    );
  }
}
