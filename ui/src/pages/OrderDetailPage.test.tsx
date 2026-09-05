import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { OrderDetailPage } from './OrderDetailPage';
import { api, ApiError } from '../api/client';
import type { Order } from '../api/types';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    api: { getOrder: vi.fn(), cancelOrder: vi.fn() },
  };
});

function renderOrderDetail(id = 'order-1') {
  return render(
    <MemoryRouter initialEntries={[`/orders/${id}`]}>
      <Routes>
        <Route path="/orders/:id" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    productId: 'sku-123',
    quantity: 2,
    customerEmail: 'buyer@example.com',
    status: 'PENDING',
    failureReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('OrderDetailPage', () => {
  beforeEach(() => {
    vi.mocked(api.getOrder).mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls again while the order is still PENDING', async () => {
    vi.mocked(api.getOrder)
      .mockResolvedValueOnce(order({ status: 'PENDING' }))
      .mockResolvedValueOnce(order({ status: 'FULFILLED' }));

    renderOrderDetail();

    expect(await screen.findByText('PENDING')).toBeInTheDocument();
    expect(api.getOrder).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2000);

    expect(await screen.findByText('FULFILLED')).toBeInTheDocument();
    expect(api.getOrder).toHaveBeenCalledTimes(2);
  });

  it('stops polling once the order reaches a terminal status', async () => {
    vi.mocked(api.getOrder).mockResolvedValue(order({ status: 'FAILED', failureReason: 'stock unavailable' }));

    renderOrderDetail();

    expect(await screen.findByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText('stock unavailable')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(5000);

    expect(api.getOrder).toHaveBeenCalledTimes(1);
  });
});

describe('OrderDetailPage cancel', () => {
  beforeEach(() => {
    vi.mocked(api.getOrder).mockReset();
    vi.mocked(api.cancelOrder).mockReset();
  });

  it('shows a Cancel button only while the order is PENDING', async () => {
    vi.mocked(api.getOrder).mockResolvedValue(order({ status: 'PENDING' }));
    renderOrderDetail();

    expect(await screen.findByRole('button', { name: /cancel order/i })).toBeInTheDocument();
  });

  it('hides the Cancel button once the order is no longer PENDING', async () => {
    vi.mocked(api.getOrder).mockResolvedValue(order({ status: 'FULFILLED' }));
    renderOrderDetail();

    await screen.findByText('FULFILLED');
    expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument();
  });

  it('optimistically shows CANCELLED, then confirms with the API result', async () => {
    vi.mocked(api.getOrder).mockResolvedValue(order({ status: 'PENDING' }));
    vi.mocked(api.cancelOrder).mockResolvedValue(order({ status: 'CANCELLED' }));

    const user = userEvent.setup();
    renderOrderDetail();

    const cancelButton = await screen.findByRole('button', { name: /cancel order/i });
    await user.click(cancelButton);

    // Optimistic update happens synchronously on click, before the API call resolves.
    expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    await waitFor(() => expect(api.cancelOrder).toHaveBeenCalledWith('order-1'));
  });

  it('reverts to the previous status and shows an error when cancelling fails', async () => {
    vi.mocked(api.getOrder).mockResolvedValue(order({ status: 'PENDING' }));
    vi.mocked(api.cancelOrder).mockRejectedValue(new ApiError(409, 'Order already fulfilled'));

    const user = userEvent.setup();
    renderOrderDetail();

    const cancelButton = await screen.findByRole('button', { name: /cancel order/i });
    await user.click(cancelButton);

    await waitFor(() => expect(screen.getByText('Order already fulfilled')).toBeInTheDocument());
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('does not let a poll tick scheduled before the cancel started overwrite the reverted state', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.getOrder).mockResolvedValue(order({ status: 'PENDING' }));
    vi.mocked(api.cancelOrder).mockRejectedValue(new ApiError(409, 'Order already fulfilled'));

    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });
    renderOrderDetail();

    const cancelButton = await screen.findByRole('button', { name: /cancel order/i });
    // First poll already scheduled its next tick ~2s out before this click.
    await user.click(cancelButton);

    // If the pre-cancel timer weren't cleared, it would fire around now and
    // could clobber the error/PENDING state with a stale success response.
    await vi.advanceTimersByTimeAsync(2000);

    expect(screen.getByText('Order already fulfilled')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();

    vi.useRealTimers();
  });
});
