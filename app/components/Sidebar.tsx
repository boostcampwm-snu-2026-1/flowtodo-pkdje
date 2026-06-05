function PlaceholderBox({ note }: { note: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
      {note}
    </div>
  );
}

function Section({ label, note }: { label: string; note: string }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </h2>
      <PlaceholderBox note={note} />
    </section>
  );
}

export function Sidebar() {
  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
      <Section label="▶ NEXT QUEST" note="추천 카드는 #14 에서 채워집니다" />
      <Section label="⚡ SIDE QUESTS" note="사이드 퀘스트는 #23 에서 채워집니다" />
      <Section label="진행 현황" note="메인/사이드 진행률은 #23 에서 채워집니다" />
    </aside>
  );
}
