'use client';

import { useAppStore } from '@/lib/store';

export function EmptyState() {
  const openCreateModal = useAppStore((s) => s.openCreateModal);

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white px-10 py-12 text-center shadow-sm">
        <div className="text-5xl">🗺</div>
        <div className="text-base font-semibold text-slate-900">
          첫 퀘스트를 만들어보세요
        </div>
        <p className="text-xs text-slate-500">
          태스크를 만들고 노드 핸들을 끌어 의존성을 그으면 NEXT QUEST 추천이
          시작됩니다.
        </p>
        <button
          type="button"
          onClick={openCreateModal}
          className="mt-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-orange-600"
        >
          + 새 태스크
        </button>
      </div>
    </div>
  );
}
