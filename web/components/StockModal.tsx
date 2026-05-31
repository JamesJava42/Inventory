'use client';
import { useState } from 'react';
import type { InventoryItem } from '@/lib/api';

interface Props {
  item: InventoryItem;
  mode: 'add' | 'remove';
  onClose: () => void;
  onConfirm: (cases: number, packs: number, singles: number) => void;
}

export default function StockModal({ item, mode, onClose, onConfirm }: Props) {
  const [cases, setCases] = useState(0);
  const [packs, setPacks] = useState(0);
  const [singles, setSingles] = useState(0);

  const total = cases * item.units_per_case + packs * item.units_per_pack + singles;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="mb-1 text-lg font-bold text-amber-400">
          {mode === 'add' ? 'Add Stock' : 'Remove Stock'}
        </h2>
        <p className="mb-6 text-sm text-slate-400">{item.name}</p>

        <div className="space-y-3">
          {[
            { label: 'Cases', value: cases, set: setCases, size: item.units_per_case },
            { label: 'Packs', value: packs, set: setPacks, size: item.units_per_pack },
            { label: 'Singles', value: singles, set: setSingles, size: 1 },
          ].map(({ label, value, set, size }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-sm text-slate-300">{label} <span className="text-slate-500">({size} units each)</span></span>
              <div className="flex items-center gap-2">
                <button onClick={() => set(Math.max(0, value - 1))}
                  className="h-8 w-8 rounded-lg bg-slate-700 font-bold text-slate-100 hover:bg-slate-600">−</button>
                <span className="w-8 text-center font-mono">{value}</span>
                <button onClick={() => set(value + 1)}
                  className="h-8 w-8 rounded-lg bg-slate-700 font-bold text-slate-100 hover:bg-slate-600">+</button>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm text-slate-400">Total: <span className="font-semibold text-slate-100">{total} unit{total !== 1 ? 's' : ''}</span></p>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-lg border border-slate-600 py-2.5 text-sm text-slate-300 hover:bg-slate-700">
            Cancel
          </button>
          <button
            disabled={total === 0}
            onClick={() => { onConfirm(cases, packs, singles); onClose(); }}
            className="flex-1 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-40">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
