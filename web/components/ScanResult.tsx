'use client';
import type { InventoryItem, MissingItem } from '@/lib/api';
import { displayStr } from '@/lib/stock';

interface Props {
  item: InventoryItem | null;
  upc: string;
  missingItems?: MissingItem[];
  mode: 'inventory' | 'missing';
  onMarkOut: (item: InventoryItem) => void;
  onPick: (missingId: string) => void;
  onDismiss: () => void;
}

export default function ScanResult({ item, upc, missingItems = [], mode, onMarkOut, onPick, onDismiss }: Props) {
  const missingEntry = item ? missingItems.find(m => m.item_id === item.id && m.status === 'missing') : null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-slate-800 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
      {item ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-700">
              {item.photo_url ? (
                <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl">🍺</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-slate-100">{item.name}</p>
              <p className="text-sm text-amber-400">
                {displayStr(item.current_units, item.units_per_case, item.units_per_pack)}
              </p>
              <p className="text-xs text-slate-500">UPC: {upc}</p>
            </div>
            <span className="shrink-0 rounded bg-green-900/60 px-2 py-1 text-xs font-bold text-green-400">Match</span>
          </div>

          {mode === 'inventory' && (
            <div className="flex gap-3">
              <button onClick={() => onMarkOut(item)}
                className="flex-1 rounded-lg bg-amber-400 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300">
                Mark Out + Add to List
              </button>
              <button onClick={onDismiss}
                className="flex-1 rounded-lg bg-slate-700 py-2.5 text-sm text-slate-300 hover:bg-slate-600">
                Dismiss
              </button>
            </div>
          )}

          {mode === 'missing' && missingEntry && (
            <div className="flex gap-3">
              <button onClick={() => onPick(missingEntry.id)}
                className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-500">
                ✓ Confirm Pickup ({missingEntry.cases_needed} case{missingEntry.cases_needed !== 1 ? 's' : ''})
              </button>
              <button onClick={onDismiss}
                className="rounded-lg bg-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-600">
                ✕ Wrong Item
              </button>
            </div>
          )}

          {mode === 'missing' && !missingEntry && (
            <div className="flex gap-3">
              <div className="flex-1 rounded-lg bg-slate-700 px-4 py-2.5 text-center text-sm text-slate-400">
                Not on your missing list
              </div>
              <button onClick={onDismiss}
                className="rounded-lg bg-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-500">
                Close
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mb-1 font-semibold text-red-400">Product not found</p>
          <p className="mb-4 text-sm text-slate-400">UPC <span className="font-mono">{upc}</span> is not in your inventory.</p>
          <div className="flex gap-3">
            <button onClick={onDismiss}
              className="flex-1 rounded-lg bg-slate-700 py-2.5 text-sm text-slate-300 hover:bg-slate-600">
              Scan Again
            </button>
          </div>
        </>
      )}
    </div>
  );
}
