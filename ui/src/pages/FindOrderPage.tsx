import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function FindOrderPage() {
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (orderId.trim()) navigate(`/orders/${orderId.trim()}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Find an Order</h1>
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-md">
        <input
          type="text"
          required
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="Order ID"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Look up
        </button>
      </form>
    </div>
  );
}
