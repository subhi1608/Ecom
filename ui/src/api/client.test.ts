import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { api } from './client';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('api.createOrder idempotency key', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 'order-1' })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches a generated Idempotency-Key header to the request', async () => {
    await api.createOrder({ productId: 'p1', quantity: 1 });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeTruthy();
  });

  it('generates a different key for each call when none is supplied', async () => {
    await api.createOrder({ productId: 'p1', quantity: 1 });
    await api.createOrder({ productId: 'p1', quantity: 1 });

    const headersOf = (callIndex: number) =>
      (vi.mocked(fetch).mock.calls[callIndex][1]?.headers as Record<string, string>)[
        'Idempotency-Key'
      ];

    expect(headersOf(0)).not.toBe(headersOf(1));
  });

  it('reuses the caller-supplied key across calls instead of generating a new one', async () => {
    await api.createOrder(
      { productId: 'p1', quantity: 1 },
      'caller-key-1',
    );
    await api.createOrder(
      { productId: 'p1', quantity: 1 },
      'caller-key-1',
    );

    const headersOf = (callIndex: number) =>
      (vi.mocked(fetch).mock.calls[callIndex][1]?.headers as Record<string, string>)[
        'Idempotency-Key'
      ];

    expect(headersOf(0)).toBe('caller-key-1');
    expect(headersOf(1)).toBe('caller-key-1');
  });
});
