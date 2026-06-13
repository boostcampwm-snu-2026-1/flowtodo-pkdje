'use client';

import { useState } from 'react';

const SUGGESTED = [
  '⚡',
  '🎨',
  '💻',
  '🔬',
  '📝',
  '🏃',
  '🎯',
  '🛠',
  '🎁',
  '📞',
  '🍴',
  '🛒',
];

export function EmojiPicker({
  value,
  onChange,
  label = '아이콘',
}: {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  label?: string;
}) {
  const [custom, setCustom] = useState('');
  const active = value ?? '⚡';

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}{' '}
        <span className="text-slate-400">
          (선택: <span className="text-base">{active}</span>)
        </span>
      </label>
      <div className="flex flex-wrap gap-1">
        {SUGGESTED.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            className={`flex h-8 w-8 items-center justify-center rounded-md border text-lg transition-colors ${
              active === emoji
                ? 'border-orange-500 bg-orange-50'
                : 'border-slate-300 bg-white hover:bg-slate-50'
            }`}
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
        <input
          type="text"
          value={custom}
          onChange={(e) => {
            const v = e.target.value;
            setCustom(v);
            if (v.length === 0) return;
            // Array.from 으로 surrogate pair 안전 처리, 첫 글자만 사용.
            const first = Array.from(v)[0];
            onChange(first);
          }}
          placeholder="🔧"
          className="h-8 w-12 rounded-md border border-slate-300 px-2 text-center text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </div>
    </div>
  );
}
