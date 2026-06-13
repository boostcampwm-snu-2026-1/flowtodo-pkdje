'use client';

import { useAppStore } from '@/lib/store';

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto rounded-md px-3 py-2 text-xs font-medium text-white shadow-lg transition-opacity hover:opacity-90 ${
            t.kind === 'error' ? 'bg-red-500' : 'bg-slate-700'
          }`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
