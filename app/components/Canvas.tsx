export function Canvas() {
  return (
    <main className="relative flex-1 overflow-hidden bg-slate-100">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-8 py-6 text-center text-sm text-slate-400">
          DAG 캔버스는 #8 에서 채워집니다
        </div>
      </div>
    </main>
  );
}
