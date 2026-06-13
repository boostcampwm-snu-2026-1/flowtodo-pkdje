'use client';

export function SkeletonLoader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
      <div className="grid grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[120px] w-[200px] animate-pulse rounded-lg border-2 border-slate-200 bg-white px-3 py-2"
          >
            <div className="mb-2 h-3 w-2/3 rounded bg-slate-200" />
            <div className="mb-2 h-4 w-5/6 rounded bg-slate-200" />
            <div className="mb-2 h-2 w-1/3 rounded bg-slate-200" />
            <div className="mt-auto h-2 w-3/4 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
