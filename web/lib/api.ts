const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001';

export type Category = 'beer' | 'wine' | 'spirits' | 'non_alcoholic';
export type ContainerType =
  | 'single' | 'six_pack' | 'twelve_pack' | 'flat_18'
  | 'case_24' | 'case_30' | 'case_12' | 'case_6';

export interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  category: Category;
  container_type: ContainerType;
  units_per_pack: number;
  units_per_case: number;
  current_units: number;
  location_id: string | null;
  created_at: string;
  updated_at: string;
  photo_url: string | null;
  tags: string[];
  upc: string | null;
  reorder_cases: number;
  min_stock_units: number | null;
}

export interface Transaction {
  id: string;
  client_uuid: string;
  item_id: string;
  delta_units: number;
  transaction_type: string;
  notes: string | null;
  created_at: string;
  server_received_at: string;
}

export interface CreateItemPayload {
  name: string;
  sku?: string;
  category: Category;
  container_type: ContainerType;
  units_per_pack: number;
  units_per_case: number;
  initial_units: number;
  photo_url?: string;
  tags?: string[];
  upc?: string;
  reorder_cases?: number;
  min_stock_units?: number;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export interface MissingItem {
  id: string;
  item_id: string;
  cases_needed: number;
  cases_picked: number;
  status: 'missing' | 'picked' | 'restocked';
  picked_at: string | null;
  created_at: string;
  product_name: string;
  product_photo: string | null;
  product_tags: string[];
  units_per_case: number;
  reorder_cases: number;
}

export const api = {
  listItems: () => req<InventoryItem[]>('/inventory/'),
  findByUPC: (upc: string) => req<InventoryItem[]>(`/inventory/?upc=${encodeURIComponent(upc)}`),
  createItem: (body: CreateItemPayload) =>
    req<InventoryItem>('/inventory/', { method: 'POST', body: JSON.stringify(body) }),
  itemHistory: (id: string) => req<Transaction[]>(`/inventory/${id}/history`),
  displayStock: (id: string) =>
    req<{ display: { cases: number; packs: number; singles: number; total_units: number } }>(
      `/inventory/${id}/display-stock`
    ),

  // Missing items
  addMissingItem: (item_id: string, cases_needed: number) =>
    req<{ status: string; id: string }>('/missing-items/', {
      method: 'POST',
      body: JSON.stringify({ item_id, cases_needed }),
    }),
  listMissingItems: () => req<MissingItem[]>('/missing-items/'),
  getMissingCount: () => req<{ count: number }>('/missing-items/count'),
  pickMissingItem: (id: string) =>
    req<{ status: string }>(`/missing-items/${id}/pick`, { method: 'POST' }),
  unpickMissingItem: (id: string) =>
    req<{ status: string }>(`/missing-items/${id}/unpick`, { method: 'POST' }),
  restockMissingItem: (id: string) =>
    req<{ status: string; delta_units: number }>(`/missing-items/${id}/restock`, { method: 'POST' }),
  removeMissingItem: (id: string) =>
    req<{ status: string }>(`/missing-items/${id}`, { method: 'DELETE' }),
};
