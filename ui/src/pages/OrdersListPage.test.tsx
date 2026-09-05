import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OrdersListPage } from './OrdersListPage';
import { api } from '../api/client';
import type { Order } from '../api/types';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    api: { listOrders: vi.fn() },
  };
});

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    productId: 'sku-1',
    quantity: 1,
    customerEmail: 'a@b.com',
    status: 'PENDING',
    failureReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('OrdersListPage', () => {
  beforeEach(() => {
    vi.mocked(api.listOrders).mockReset();
  });

  it('lists orders returned by the API', async () => {
    vi.mocked(api.listOrders).mockResolvedValue({
      data: [order({ id: 'order-1' }), order({ id: 'order-2', status: 'FULFILLED' })],
      total: 2,
      page: 1,
      limit: 20,
    });

    render(
      <MemoryRouter>
        <OrdersListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('order-1')).toBeInTheDocument();
    expect(screen.getByText('order-2')).toBeInTheDocument();
    expect(api.listOrders).toHaveBeenCalledWith({ status: undefined, page: 1, limit: 20 });
  });

  it('re-queries with the selected status filter', async () => {
    vi.mocked(api.listOrders).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OrdersListPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.listOrders).toHaveBeenCalledTimes(1));

    await user.selectOptions(screen.getByLabelText('Status'), 'FULFILLED');

    await waitFor(() =>
      expect(api.listOrders).toHaveBeenLastCalledWith({ status: 'FULFILLED', page: 1, limit: 20 }),
    );
  });

  it('advances to the next page and requests it from the API', async () => {
    vi.mocked(api.listOrders).mockResolvedValue({
      data: [order()],
      total: 50,
      page: 1,
      limit: 20,
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OrdersListPage />
      </MemoryRouter>,
    );

    await screen.findByText('order-1');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() =>
      expect(api.listOrders).toHaveBeenLastCalledWith({ status: undefined, page: 2, limit: 20 }),
    );
  });
});
