import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Order } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';

const POLL_INTERVAL_MS = 2000;

// Statuses that won't change again — stop polling once we hit one.
const TERMINAL_STATUSES = new Set(['FULFILLED', 'FAILED', 'CANCELLED']);

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  // Shared by the mount-time poll loop AND by handleCancel (to resume
  // polling with a fresh fetch after a failed cancel), so both paths run
  // through the same "clear any pending tick, then reschedule" logic
  // instead of a stray old timer being able to overwrite fresher state.
  const poll = useCallback(async () => {
    if (!id) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      const result = await api.getOrder(id);
      if (unmountedRef.current) return;
      setOrder(result);
      setError(null);
      if (!TERMINAL_STATUSES.has(result.status)) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    } catch (err) {
      if (unmountedRef.current) return;
      setError(err instanceof ApiError ? err.message : 'Could not load this order.');
    } finally {
      if (!unmountedRef.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    unmountedRef.current = false;
    poll();

    return () => {
      unmountedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [poll]);

  async function handleCancel() {
    if (!id || !order) return;
    const previous = order;
    // A pending poll tick scheduled before the cancel started could
    // otherwise land mid-cancel and overwrite the optimistic/reverted state
    // with data fetched before this attempt even began.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Optimistic: reflect the cancellation immediately, reconcile (or
    // revert) once the API responds.
    setOrder({ ...order, status: 'CANCELLED' });
    setError(null);
    setCancelling(true);
    try {
      const result = await api.cancelOrder(id);
      setOrder(result);
    } catch (err) {
      setOrder(previous);
      setError(err instanceof ApiError ? err.message : 'Could not cancel this order.');
      // Resume polling on the normal cadence instead of leaving the
      // reverted state unwatched — scheduled, not immediate, so the error
      // message above stays visible instead of being wiped out right away.
      if (!TERMINAL_STATUSES.has(previous.status)) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div>
      <Link to="/orders" className="text-sm text-slate-500 hover:underline">
        ← Find another order
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900 mt-2 mb-6">Order Detail</h1>

      {loading && !order && <p className="text-sm text-slate-500">Loading…</p>}

      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 max-w-md">
          {error}
        </p>
      )}

      {order && (
        <div className="rounded-md border border-slate-200 bg-white p-4 max-w-md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-slate-900">Order {order.id}</h2>
            <StatusBadge status={order.status} />
          </div>
          <dl className="text-sm text-slate-600 space-y-1">
            <div className="flex justify-between">
              <dt>Product</dt>
              <dd>{order.productId}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Quantity</dt>
              <dd>{order.quantity}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Customer</dt>
              <dd>{order.customerEmail}</dd>
            </div>
            {order.failureReason && (
              <div className="flex justify-between">
                <dt>Failure reason</dt>
                <dd className="text-red-700">{order.failureReason}</dd>
              </div>
            )}
          </dl>
          {!TERMINAL_STATUSES.has(order.status) && (
            <p className="mt-3 text-xs text-slate-400">Watching for status updates…</p>
          )}
          {order.status === 'PENDING' && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {cancelling ? 'Cancelling…' : 'Cancel Order'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
