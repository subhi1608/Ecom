import { useState } from 'react';
import { api, ApiError } from '../api/client';
import type { InventoryItem } from '../api/types';

export function InventoryPage() {
  const [productId, setProductId] = useState('');
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setItem(null);
    setLoading(true);
    try {
      const result = await api.getStock(productId);
      setItem(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not look up stock.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Inventory</h1>

      <form onSubmit={handleSubmit} className="flex gap-2 max-w-md">
        <div className="flex-1">
          <label htmlFor="inventory-product-id" className="sr-only">
            Product ID
          </label>
          <input
            id="inventory-product-id"
            aria-label="Product ID"
            type="text"
            required
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="Product ID"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Check Stock'}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 max-w-md">
          {error}
        </p>
      )}

      {item && (
        <div className="mt-6 rounded-md border border-slate-200 bg-white p-4 max-w-md">
          <dl className="text-sm text-slate-600 space-y-1">
            <div className="flex justify-between">
              <dt>Product</dt>
              <dd>{item.productId}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Available</dt>
              <dd className="font-semibold text-slate-900">{item.available}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
