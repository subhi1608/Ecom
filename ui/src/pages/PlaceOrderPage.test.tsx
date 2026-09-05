import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlaceOrderPage } from './PlaceOrderPage';
import { api, ApiError } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    api: { createOrder: vi.fn() },
  };
});

function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  return async () => {
    await user.type(screen.getByLabelText('Product ID'), 'sku-123');
    await user.clear(screen.getByLabelText('Quantity'));
    await user.type(screen.getByLabelText('Quantity'), '2');
    await user.type(screen.getByLabelText('Customer Email'), 'buyer@example.com');
    await user.click(screen.getByRole('button', { name: /place order/i }));
  };
}

describe('PlaceOrderPage', () => {
  beforeEach(() => {
    vi.mocked(api.createOrder).mockReset();
  });

  it('submits the form and shows the created order', async () => {
    vi.mocked(api.createOrder).mockResolvedValue({
      id: 'order-1',
      productId: 'sku-123',
      quantity: 2,
      customerEmail: 'buyer@example.com',
      status: 'PENDING',
      failureReason: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PlaceOrderPage />
      </MemoryRouter>,
    );

    await fillAndSubmit(user)();

    expect(api.createOrder).toHaveBeenCalledWith(
      { productId: 'sku-123', quantity: 2, customerEmail: 'buyer@example.com' },
      expect.any(String),
    );

    expect(await screen.findByText('Order placed')).toBeInTheDocument();
    expect(screen.getByText('order-1')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('shows the API error message when order creation fails', async () => {
    vi.mocked(api.createOrder).mockRejectedValue(
      new ApiError(400, 'quantity must not be less than 1'),
    );

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PlaceOrderPage />
      </MemoryRouter>,
    );

    await fillAndSubmit(user)();

    await waitFor(() => {
      expect(screen.getByText('quantity must not be less than 1')).toBeInTheDocument();
    });
    expect(screen.queryByText('Order placed')).not.toBeInTheDocument();
  });

  it('reuses the same Idempotency-Key if the submit handler fires twice before it resolves', async () => {
    let resolveFirst: (v: Awaited<ReturnType<typeof api.createOrder>>) => void = () => {};
    vi.mocked(api.createOrder).mockImplementation(
      () => new Promise((resolve) => { resolveFirst = resolve; }),
    );

    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <PlaceOrderPage />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText('Product ID'), 'sku-123');
    await user.clear(screen.getByLabelText('Quantity'));
    await user.type(screen.getByLabelText('Quantity'), '2');
    await user.type(screen.getByLabelText('Customer Email'), 'buyer@example.com');

    // Simulate a double-click firing the handler twice back-to-back, both
    // before React has re-rendered the disabled button.
    const form = container.querySelector('form')!;
    const submitEvent = () => {
      const event = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
    };
    submitEvent();
    submitEvent();

    resolveFirst({
      id: 'order-1',
      productId: 'sku-123',
      quantity: 2,
      customerEmail: 'buyer@example.com',
      status: 'PENDING',
      failureReason: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await screen.findByText('Order placed');

    expect(api.createOrder).toHaveBeenCalledTimes(2);
    const [, key1] = vi.mocked(api.createOrder).mock.calls[0];
    const [, key2] = vi.mocked(api.createOrder).mock.calls[1];
    expect(key1).toBe(key2);
  });
});
