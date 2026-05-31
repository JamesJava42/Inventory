'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { api, type InventoryItem } from '@/lib/api';
import { displayStr } from '@/lib/stock';
import StockModal from '@/components/StockModal';

type Modal = { item: InventoryItem; mode: 'add' | 'remove' } | null;

export default function InventoryPage() {
  const { session, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [missingCount, setMissingCount] = useState(0);
  const [markingOut, setMarkingOut] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !session) router.replace('/login');
  }, [session, authLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemData, countData] = await Promise.all([
        api.listItems(),
        api.getMissingCount(),
      ]);
      setItems(itemData);
      setMissingCount(countData.count);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (session) load(); }, [session, load]);

  const allTags = Array.from(new Set(items.flatMap(i => i.tags ?? []))).sort();

  const toggleTag = (tag: string) =>
    setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const filtered = items.filter(item => {
    const matchSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (item.upc ?? '').includes(search);
    const matchTags = activeTags.length === 0 || activeTags.every(t => (item.tags ?? []).includes(t));
    return matchSearch && matchTags;
  });

  const outCount = items.filter(i => i.current_units === 0).length;
  const lowCount = items.filter(i => i.current_units > 0 && i.current_units < i.units_per_case).length;

  const handleAdjust = async (item: InventoryItem, cases: number, packs: number, singles: number, subtract: boolean) => {
    const total = cases * item.units_per_case + packs * item.units_per_pack + singles;
    const delta = subtract ? -total : total;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: [{
            client_uuid: crypto.randomUUID(),
            item_id: item.id,
            delta_units: delta,
            transaction_type: subtract ? 'sale' : 'restock',
            created_at: new Date().toISOString(),
            notes: null,
          }],
        }),
      });
      await load();
    } catch (e) { console.error(e); }
  };

  const handleMarkOut = async (item: InventoryItem) => {
    const casesStr = window.prompt(
      `Mark "${item.name}" as OUT OF STOCK.\n\nHow many cases to reorder?`,
      String(item.reorder_cases ?? 1)
    );
    if (casesStr === null) return;
    const cases = parseInt(casesStr, 10);
    if (isNaN(cases) || cases < 1) return;

    setMarkingOut(item.id);
    try {
      // Zero out stock if any remains
      if (item.current_units > 0) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sync/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactions: [{
              client_uuid: crypto.randomUUID(),
              item_id: item.id,
              delta_units: -item.current_units,
              transaction_type: 'adjustment',
              created_at: new Date().toISOString(),
              notes: `Marked out — zeroed ${item.current_units} units`,
            }],
          }),
        });
      }
      // Add to missing list
      await api.addMissingItem(item.id, cases);
      await load();
    } catch (e) { console.error(e); }
    setMarkingOut(null);
  };

  if (authLoading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">Inventory</h1>
          <p className="text-xs text-slate-500">
            {items.length} products
            {outCount > 0 && <span className="ml-2 text-red-400">{outCount} out</span>}
            {lowCount > 0 && <span className="ml-2 text-yellow-400">{lowCount} low</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/missing"
            className="relative flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-600">
            🛒 Missing
            {missingCount > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-slate-900">
                {missingCount}
              </span>
            )}
          </Link>
          <button onClick={() => router.push('/inventory/add')}
            className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300">
            + Add
          </button>
          <button onClick={signOut}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
            Sign out
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search name, SKU, or UPC…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-3 w-full rounded-lg bg-slate-800 px-4 py-2.5 text-slate-100 outline-none focus:ring-2 focus:ring-amber-400"
      />

      {/* Tag filter pills */}
      {allTags.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {activeTags.length > 0 && (
            <button onClick={() => setActiveTags([])}
              className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-400 hover:text-slate-100">
              Clear
            </button>
          )}
          {allTags.map(tag => (
            <button key={tag} onClick={() => toggleTag(tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                activeTags.includes(tag)
                  ? 'bg-amber-400 text-slate-900'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}>
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Items */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-20 text-center text-slate-500">No items found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const isOut = item.current_units === 0;
            const isLow = !isOut && item.current_units < item.units_per_case;
            const isMarking = markingOut === item.id;
            return (
              <div key={item.id} className="flex items-center gap-3 rounded-xl bg-slate-800 px-4 py-3">

                {/* Photo */}
                <div
                  className="h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-slate-700"
                  onClick={() => router.push(`/inventory/${item.id}/history`)}
                >
                  {item.photo_url ? (
                    <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl text-slate-600">
                      {item.category === 'beer' ? '🍺' : item.category === 'wine' ? '🍷' : item.category === 'spirits' ? '🥃' : '🥤'}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => router.push(`/inventory/${item.id}/history`)}>
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-slate-100">{item.name}</p>
                    {isOut && <span className="shrink-0 rounded bg-red-900/60 px-1.5 py-0.5 text-xs font-bold text-red-400">OUT</span>}
                    {isLow && <span className="shrink-0 rounded bg-yellow-900/60 px-1.5 py-0.5 text-xs font-bold text-yellow-400">LOW</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {(item.tags ?? []).map(t => (
                      <span key={t} className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">{t}</span>
                    ))}
                  </div>
                  <p className={`mt-1 text-sm font-medium ${isOut ? 'text-red-400' : isLow ? 'text-yellow-400' : 'text-amber-400'}`}>
                    {displayStr(item.current_units, item.units_per_case, item.units_per_pack)}
                    <span className="ml-2 text-xs text-slate-500">({item.current_units} units)</span>
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex shrink-0 flex-col gap-1.5">
                  <div className="flex gap-1.5">
                    <button onClick={() => setModal({ item, mode: 'remove' })}
                      disabled={isOut}
                      className="h-8 w-8 rounded-lg bg-slate-700 font-bold text-slate-100 hover:bg-red-900/60 disabled:opacity-30">
                      −
                    </button>
                    <button onClick={() => setModal({ item, mode: 'add' })}
                      className="h-8 w-8 rounded-lg bg-slate-700 font-bold text-slate-100 hover:bg-green-900/60">
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => handleMarkOut(item)}
                    disabled={isMarking}
                    className="rounded-lg bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-400 hover:bg-amber-500/40 disabled:opacity-50">
                    {isMarking ? '…' : 'Out'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <StockModal
          item={modal.item}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onConfirm={(c, p, s) => handleAdjust(modal.item, c, p, s, modal.mode === 'remove')}
        />
      )}
    </div>
  );
}
