'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { api, type MissingItem } from '@/lib/api';
import BarcodeScanner from '@/components/BarcodeScanner';
import ScanResult from '@/components/ScanResult';
import type { InventoryItem } from '@/lib/api';

type ActionState = Record<string, 'picking' | 'restocking' | 'removing'>;

export default function MissingPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<MissingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<ActionState>({});
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ upc: string; item: InventoryItem | null } | null>(null);

  useEffect(() => {
    if (!authLoading && !session) router.replace('/login');
  }, [session, authLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await api.listMissingItems()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (session) load(); }, [session, load]);

  const setAction = (id: string, action: ActionState[string] | null) =>
    setActions(prev => {
      const next = { ...prev };
      if (action === null) delete next[id]; else next[id] = action;
      return next;
    });

  const handlePick = async (item: MissingItem) => {
    setAction(item.id, 'picking');
    try {
      await api.pickMissingItem(item.id);
      await load();
    } catch (e) { console.error(e); }
    setAction(item.id, null);
  };

  const handleUnpick = async (item: MissingItem) => {
    setAction(item.id, 'picking');
    try {
      await api.unpickMissingItem(item.id);
      await load();
    } catch (e) { console.error(e); }
    setAction(item.id, null);
  };

  const handleRestock = async (item: MissingItem) => {
    setAction(item.id, 'restocking');
    try {
      await api.restockMissingItem(item.id);
      await load();
    } catch (e) { console.error(e); }
    setAction(item.id, null);
  };

  const handleRemove = async (item: MissingItem) => {
    if (!window.confirm(`Remove "${item.product_name}" from the list?`)) return;
    setAction(item.id, 'removing');
    try {
      await api.removeMissingItem(item.id);
      await load();
    } catch (e) { console.error(e); }
    setAction(item.id, null);
  };

  const handleScanDetected = async (upc: string) => {
    setScanning(false);
    const results = await api.findByUPC(upc);
    setScanResult({ upc, item: results[0] ?? null });
  };

  const missing = items.filter(i => i.status === 'missing');
  const picked  = items.filter(i => i.status === 'picked');

  // Group missing items by first dealer-like tag (anything not a category)
  const CATEGORY_TAGS = new Set(['beer', 'wine', 'spirits', 'non_alcoholic', 'lager', 'ipa', 'import', 'domestic']);
  const dealerTag = (item: MissingItem) =>
    item.product_tags.find(t => !CATEGORY_TAGS.has(t)) ?? 'Other';

  const grouped = missing.reduce<Record<string, MissingItem[]>>((acc, item) => {
    const key = dealerTag(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});

  if (authLoading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button onClick={() => router.push('/inventory')} className="mb-1 text-sm text-slate-400 hover:text-slate-100">
            ← Inventory
          </button>
          <h1 className="text-2xl font-bold text-amber-400">Missing Items</h1>
          <p className="text-xs text-slate-500">{missing.length} to buy · {picked.length} picked</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setScanning(true)}
            className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-600">
            📷 Scan
          </button>
          {picked.length > 0 && (
            <button
              onClick={async () => {
                if (!window.confirm(`Restock all ${picked.length} picked items?`)) return;
                for (const item of picked) await handleRestock(item);
              }}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-500">
              Restock All ({picked.length})
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-lg font-semibold text-slate-200">All stocked up!</p>
          <p className="mt-1 text-sm text-slate-500">No missing items. Use the Out button on any product to add to this list.</p>
          <button onClick={() => router.push('/inventory')}
            className="mt-6 rounded-lg bg-amber-400 px-6 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300">
            Back to Inventory
          </button>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Need to buy — grouped by dealer */}
          {missing.length > 0 && Object.entries(grouped).map(([dealer, dealerItems]) => (
            <div key={dealer} className="rounded-2xl bg-slate-800 overflow-hidden">
              <div className="flex items-center justify-between bg-slate-700/60 px-4 py-2.5">
                <p className="font-semibold text-slate-100 capitalize">{dealer}</p>
                <p className="text-xs text-slate-400">{dealerItems.length} item{dealerItems.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="divide-y divide-slate-700/60">
                {dealerItems.map(item => (
                  <MissingCard
                    key={item.id}
                    item={item}
                    actionState={actions[item.id] ?? null}
                    onPick={() => handlePick(item)}
                    onRemove={() => handleRemove(item)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Picked — ready to restock */}
          {picked.length > 0 && (
            <div className="rounded-2xl bg-slate-800 overflow-hidden">
              <div className="flex items-center justify-between bg-green-900/40 px-4 py-2.5">
                <p className="font-semibold text-green-400">Picked — Ready to Restock</p>
                <p className="text-xs text-slate-400">{picked.length} item{picked.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="divide-y divide-slate-700/60">
                {picked.map(item => (
                  <PickedCard
                    key={item.id}
                    item={item}
                    actionState={actions[item.id] ?? null}
                    onRestock={() => handleRestock(item)}
                    onUnpick={() => handleUnpick(item)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {scanning && (
        <BarcodeScanner
          onDetected={handleScanDetected}
          onClose={() => setScanning(false)}
        />
      )}

      {scanResult && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setScanResult(null)}>
          <ScanResult
            item={scanResult.item}
            upc={scanResult.upc}
            missingItems={items}
            mode="missing"
            onMarkOut={() => {}}
            onPick={async (missingId) => {
              setScanResult(null);
              const entry = items.find(i => i.id === missingId);
              if (entry) await handlePick(entry);
            }}
            onDismiss={() => setScanResult(null)}
          />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function MissingCard({ item, actionState, onPick, onRemove }: {
  item: MissingItem;
  actionState: string | null;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Photo */}
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-700">
        {item.product_photo ? (
          <img src={item.product_photo} alt={item.product_name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl text-slate-600">🍺</div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-100">{item.product_name}</p>
        <p className="text-sm text-amber-400">
          Need: <span className="font-bold">{item.cases_needed} case{item.cases_needed !== 1 ? 's' : ''}</span>
          <span className="ml-2 text-xs text-slate-500">({item.cases_needed * item.units_per_case} units)</span>
        </p>
        {item.product_tags.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {item.product_tags.map(t => (
              <span key={t} className="rounded-full bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col gap-1.5">
        <button onClick={onPick} disabled={!!actionState}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-500 disabled:opacity-50">
          {actionState === 'picking' ? '…' : '✓ Picked'}
        </button>
        <button onClick={onRemove} disabled={!!actionState}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-red-400 disabled:opacity-50">
          Remove
        </button>
      </div>
    </div>
  );
}

function PickedCard({ item, actionState, onRestock, onUnpick }: {
  item: MissingItem;
  actionState: string | null;
  onRestock: () => void;
  onUnpick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Photo */}
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-700">
        {item.product_photo ? (
          <img src={item.product_photo} alt={item.product_name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl text-slate-600">🍺</div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-100">{item.product_name}</p>
        <p className="text-sm text-green-400">
          Picked: <span className="font-bold">{item.cases_needed} case{item.cases_needed !== 1 ? 's' : ''}</span>
          {item.picked_at && (
            <span className="ml-2 text-xs text-slate-500">
              {new Date(item.picked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col gap-1.5">
        <button onClick={onRestock} disabled={!!actionState}
          className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-50">
          {actionState === 'restocking' ? '…' : 'Restock'}
        </button>
        <button onClick={onUnpick} disabled={!!actionState}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-100 disabled:opacity-50">
          Undo
        </button>
      </div>
    </div>
  );
}
