import { NextQuestPanel } from './NextQuestPanel';
import { ProgressPanel } from './ProgressPanel';
import { SideQuestsPanel } from './SideQuestsPanel';

export function Sidebar() {
  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
      <NextQuestPanel />
      <SideQuestsPanel />
      <ProgressPanel />
    </aside>
  );
}
