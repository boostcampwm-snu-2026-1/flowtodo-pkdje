'use client';

import { signOut, useSession } from 'next-auth/react';
import { useAppStore } from '@/lib/store';

export function Header() {
  const openCreateModal = useAppStore((s) => s.openCreateModal);
  const { data: session, status } = useSession();

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <h1 className="text-lg font-semibold text-slate-900">flowtodo</h1>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600"
        >
          + 새 태스크
        </button>
        <button
          type="button"
          aria-label="설정"
          className="rounded-md p-2 text-slate-600 transition-colors hover:bg-slate-100"
        >
          ⚙
        </button>
        <div className="mx-2 h-6 w-px bg-slate-200" />
        {status === 'authenticated' && session?.user && (
          <div className="flex items-center gap-2">
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name ?? 'user'}
                className="h-7 w-7 rounded-full border border-slate-200"
              />
            )}
            <span className="hidden text-sm text-slate-700 sm:inline">
              {session.user.name ?? session.user.email ?? 'user'}
            </span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/api/auth/signin' })}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              로그아웃
            </button>
          </div>
        )}
        {status === 'loading' && (
          <span className="text-xs text-slate-400">…</span>
        )}
      </div>
    </header>
  );
}
