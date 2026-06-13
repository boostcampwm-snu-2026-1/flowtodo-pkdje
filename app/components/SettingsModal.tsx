'use client';

import { useAppStore } from '@/lib/store';

export function SettingsModal() {
  const open = useAppStore((s) => s.settingsModalOpen);
  const close = useAppStore((s) => s.closeSettings);
  const weights = useAppStore((s) => s.weights);
  const setWeights = useAppStore((s) => s.setWeights);
  const resetWeights = useAppStore((s) => s.resetWeights);

  if (!open) return null;

  const wPriority = weights.wPriority;
  const wImpact = weights.wImpact;

  function handleSlider(e: React.ChangeEvent<HTMLInputElement>) {
    const wp = Number(e.target.value) / 100;
    // 정규화: 합쳐서 1.0
    setWeights({ wPriority: wp, wImpact: 1 - wp });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">설정</h2>
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <section className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              추천 가중치
            </label>
            <p className="mb-3 text-xs text-slate-500">
              왼쪽 = priority 중시, 오른쪽 = impact (다운스트림) 중시. 합은
              자동으로 1.0 으로 정규화됩니다.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-600">
                priority {wPriority.toFixed(2)}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(wPriority * 100)}
                onChange={handleSlider}
                className="flex-1 accent-orange-500"
              />
              <span className="text-xs font-medium text-slate-600">
                impact {wImpact.toFixed(2)}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              0 = 한쪽만 / 1 = 반대쪽만. 기본 0.6/0.4.
            </div>
          </div>

          <button
            type="button"
            onClick={resetWeights}
            className="text-xs font-medium text-orange-600 hover:text-orange-700"
          >
            기본값으로 리셋
          </button>
        </section>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={close}
            className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
