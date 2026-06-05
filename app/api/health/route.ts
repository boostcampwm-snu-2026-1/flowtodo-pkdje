import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongo';

// Health 는 본질적으로 매 요청마다 실제 DB 상태를 ping 해야 의미가 있으므로
// Route Handler 의 정적 캐싱을 끔. (기본값으로 두면 build 시점 응답이 캐싱됨.)
export const dynamic = 'force-dynamic';

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
