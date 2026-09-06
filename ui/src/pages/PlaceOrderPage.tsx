import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Order } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';

export function PlaceOrderPage() {
  const navigate = useNavigate();
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // One key per submission *attempt*, not per API call — a double-click that
  // fires two requests before the button disables (or a future caller-side
  // retry) reuses this same key, so the backend collapses them into one
  // order instead of creating two. A fresh key is only drawn once this
  // attempt resolves, since the next submit is a genuinely new order.
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const order = await api.createOrder(
        { productId, quantity: Number(quantity) },
        idempotencyKeyRef.current,
      );
      setPlacedOrder(order);
      idempotencyKeyRef.current = crypto.randomUUID();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong placing the order.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Place an Order</h1>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label htmlFor="productId" className="block text-sm font-medium text-slate-700 mb-1">
            Product ID
          </label>
          <input
            id="productId"
            type="text"
            required
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            placeholder="e.g. sku-123"
          />
        </div>

        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-slate-700 mb-1">
            Quantity
          </label>
          <input
            id="quantity"
            type="number"
            min={1}
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {submitting ? 'Placing order…' : 'Place Order'}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 max-w-md">
          {error}
        </p>
      )}

      {placedOrder && (
        <div className="mt-6 rounded-md border border-slate-200 bg-white p-4 max-w-md">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-slate-900">Order placed</h2>
            <StatusBadge status={placedOrder.status} />
          </div>
          <dl className="text-sm text-slate-600 space-y-1">
            <div className="flex justify-between">
              <dt>Order ID</dt>
              <dd className="font-mono text-xs">{placedOrder.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Product</dt>
              <dd>{placedOrder.productId}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Quantity</dt>
              <dd>{placedOrder.quantity}</dd>
            </div>
          </dl>
          <button
            onClick={() => navigate(`/orders/${placedOrder.id}`)}
            className="mt-3 text-sm font-medium text-slate-900 underline underline-offset-2"
          >
            Track this order →
          </button>
        </div>
      )}
    </div>
  );
}
