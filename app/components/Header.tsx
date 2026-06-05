export function Header() {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <h1 className="text-lg font-semibold text-slate-900">flowtodo</h1>
      <div className="flex items-center gap-2">
        <button
          type="button"
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
      </div>
    </header>
  );
}
