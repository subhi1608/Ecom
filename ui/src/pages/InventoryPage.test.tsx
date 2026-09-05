import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { InventoryPage } from './InventoryPage';
import { api, ApiError } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    api: { getStock: vi.fn() },
  };
});

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.mocked(api.getStock).mockReset();
  });

  it('looks up and displays stock for the entered product', async () => {
    vi.mocked(api.getStock).mockResolvedValue({ productId: 'sku-1', available: 42 });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Product ID'), 'sku-1');
    await user.click(screen.getByRole('button', { name: /check stock/i }));

    expect(api.getStock).toHaveBeenCalledWith('sku-1');
    expect(await screen.findByText('42')).toBeInTheDocument();
  });

  it('shows an error message when the lookup fails', async () => {
    vi.mocked(api.getStock).mockRejectedValue(new ApiError(404, 'Product not found'));

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Product ID'), 'missing');
    await user.click(screen.getByRole('button', { name: /check stock/i }));

    await waitFor(() => expect(screen.getByText('Product not found')).toBeInTheDocument());
  });
});
