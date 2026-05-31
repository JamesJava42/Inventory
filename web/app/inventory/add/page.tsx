'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { api, type Category, type ContainerType } from '@/lib/api';

const CATEGORIES: Category[] = ['beer', 'wine', 'spirits', 'non_alcoholic'];
const CONTAINERS: ContainerType[] = ['single', 'six_pack', 'twelve_pack', 'flat_18', 'case_24', 'case_30', 'case_12', 'case_6'];

const CONTAINER_UNITS: Record<ContainerType, { unitsPerCase: number; unitsPerPack: number }> = {
  single:      { unitsPerCase: 1,  unitsPerPack: 1 },
  six_pack:    { unitsPerCase: 6,  unitsPerPack: 6 },
  twelve_pack: { unitsPerCase: 12, unitsPerPack: 6 },
  flat_18:     { unitsPerCase: 18, unitsPerPack: 6 },
  case_24:     { unitsPerCase: 24, unitsPerPack: 6 },
  case_30:     { unitsPerCase: 30, unitsPerPack: 1 },
  case_12:     { unitsPerCase: 12, unitsPerPack: 1 },
  case_6:      { unitsPerCase: 6,  unitsPerPack: 1 },
};

const SUGGESTED_TAGS = ['beer', 'wine', 'spirits', 'lager', 'ipa', 'import', 'domestic', 'harbor', 'jetros', 'sams'];

export default function AddProductPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [upc, setUpc] = useState('');
  const [category, setCategory] = useState<Category>('beer');
  const [containerType, setContainerType] = useState<ContainerType>('case_24');
  const [initialUnits, setInitialUnits] = useState(0);
  const [reorderCases, setReorderCases] = useState(2);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const { unitsPerCase, unitsPerPack } = CONTAINER_UNITS[containerType];

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === 'Backspace' && !tagInput && tags.length) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('product-photos').upload(path, file, { contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from('product-photos').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setError('');
    setSaving(true);

    try {
      let photo_url: string | undefined;
      if (photoFile) {
        setUploading(true);
        photo_url = await uploadPhoto(photoFile);
        setUploading(false);
      }

      const allTags = [...new Set([...tags, category])];

      await api.createItem({
        name: name.trim(),
        sku: sku.trim() || undefined,
        upc: upc.trim() || undefined,
        category,
        container_type: containerType,
        units_per_case: unitsPerCase,
        units_per_pack: unitsPerPack,
        initial_units: initialUnits,
        reorder_cases: reorderCases,
        tags: allTags,
        photo_url,
      });
      router.replace('/inventory');
    } catch {
      setError('Failed to save. Is the backend running? Is the photo bucket created in Supabase?');
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-100">← Back</button>
        <h1 className="text-xl font-bold text-amber-400">Add Product</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-slate-800 p-6">

        {/* Photo */}
        <div>
          <label className="mb-2 block text-sm text-slate-300">Product Photo</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="flex h-40 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-600 bg-slate-700 hover:border-amber-400"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="preview" className="h-full w-full object-cover" />
            ) : (
              <div className="text-center text-slate-500">
                <div className="text-3xl mb-1">📷</div>
                <p className="text-xs">Tap to add label photo</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          {photoPreview && (
            <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
              className="mt-1 text-xs text-slate-500 hover:text-red-400">
              Remove photo
            </button>
          )}
        </div>

        {/* Name */}
        <div>
          <label className="mb-1 block text-sm text-slate-300">Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} required
            className="w-full rounded-lg bg-slate-700 px-4 py-2.5 text-slate-100 outline-none focus:ring-2 focus:ring-amber-400" />
        </div>

        {/* UPC */}
        <div>
          <label className="mb-1 block text-sm text-slate-300">UPC / Barcode</label>
          <input value={upc} onChange={e => setUpc(e.target.value)} placeholder="034000123456"
            className="w-full rounded-lg bg-slate-700 px-4 py-2.5 font-mono text-slate-100 outline-none focus:ring-2 focus:ring-amber-400" />
        </div>

        {/* SKU */}
        <div>
          <label className="mb-1 block text-sm text-slate-300">SKU (optional)</label>
          <input value={sku} onChange={e => setSku(e.target.value)}
            className="w-full rounded-lg bg-slate-700 px-4 py-2.5 text-slate-100 outline-none focus:ring-2 focus:ring-amber-400" />
        </div>

        {/* Tags */}
        <div>
          <label className="mb-1 block text-sm text-slate-300">Tags</label>
          <div className="min-h-[44px] flex flex-wrap gap-1.5 rounded-lg bg-slate-700 px-3 py-2 focus-within:ring-2 focus-within:ring-amber-400">
            {tags.map(t => (
              <span key={t} className="flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                {t}
                <button type="button" onClick={() => removeTag(t)} className="text-amber-400 hover:text-white">×</button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => tagInput && addTag(tagInput)}
              placeholder={tags.length ? '' : 'beer, harbor, ipa…'}
              className="min-w-[100px] flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTED_TAGS.filter(t => !tags.includes(t)).map(t => (
              <button key={t} type="button" onClick={() => addTag(t)}
                className="rounded-full border border-slate-600 px-2.5 py-0.5 text-xs text-slate-400 hover:border-amber-400 hover:text-amber-400">
                + {t}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="mb-1 block text-sm text-slate-300">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value as Category)}
            className="w-full rounded-lg bg-slate-700 px-4 py-2.5 text-slate-100 outline-none focus:ring-2 focus:ring-amber-400">
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
          </select>
        </div>

        {/* Container type */}
        <div>
          <label className="mb-1 block text-sm text-slate-300">Container type</label>
          <select value={containerType} onChange={e => setContainerType(e.target.value as ContainerType)}
            className="w-full rounded-lg bg-slate-700 px-4 py-2.5 text-slate-100 outline-none focus:ring-2 focus:ring-amber-400">
            {CONTAINERS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">{unitsPerCase} units/case · {unitsPerPack} units/pack</p>
        </div>

        {/* Initial stock + reorder */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Initial stock (units)</label>
            <input type="number" min={0} value={initialUnits} onChange={e => setInitialUnits(Number(e.target.value))}
              className="w-full rounded-lg bg-slate-700 px-4 py-2.5 text-slate-100 outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Reorder (cases)</label>
            <input type="number" min={1} value={reorderCases} onChange={e => setReorderCases(Number(e.target.value))}
              className="w-full rounded-lg bg-slate-700 px-4 py-2.5 text-slate-100 outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={saving}
          className="w-full rounded-lg bg-amber-400 py-2.5 font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-50">
          {uploading ? 'Uploading photo…' : saving ? 'Saving…' : 'Save Product'}
        </button>
      </form>
    </div>
  );
}
