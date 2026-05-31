'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, type Transaction } from '@/lib/api';

export default function HistoryPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.itemHistory(id)
      .then(setTxns)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const totalIn = txns.filter(t => t.delta_units > 0).reduce((s, t) => s + t.delta_units, 0);
  const totalOut = txns.filter(t => t.delta_units < 0).reduce((s, t) => s + Math.abs(t.delta_units), 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-100">← Back</button>
        <h1 className="text-xl font-bold text-amber-400">Transaction History</h1>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-slate-800 p-4 text-center">
          <p className="text-2xl font-bold text-green-400">+{totalIn}</p>
          <p className="text-xs text-slate-400">units added</p>
        </div>
        <div className="rounded-xl bg-slate-800 p-4 text-center">
          <p className="text-2xl font-bold text-red-400">−{totalOut}</p>
          <p className="text-xs text-slate-400">units removed</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : txns.length === 0 ? (
        <p className="py-20 text-center text-slate-500">No transactions yet.</p>
      ) : (
        <div className="space-y-2">
          {txns.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3">
              <div>
                <p className="text-sm font-medium capitalize text-slate-200">{t.transaction_type}</p>
                <p className="text-xs text-slate-500">
                  {new Date(t.server_received_at).toLocaleString()}
                </p>
                {t.notes && <p className="text-xs text-slate-400">{t.notes}</p>}
              </div>
              <span className={`text-lg font-bold ${t.delta_units > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {t.delta_units > 0 ? '+' : ''}{t.delta_units}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
