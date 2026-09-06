import type {
  AuthUser,
  CreateOrderInput,
  Credentials,
  InventoryItem,
  Order,
  PaginatedOrders,
} from './types';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3000';

export class ApiError extends Error {
  statusCode: number;
  path?: string;

  constructor(statusCode: number, message: string, path?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.path = path;
  }
}

// Every request funnels through this one function. When auth lands (Sprint 6),
// the Authorization header slots in right here — nowhere else needs to change.
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}${path}`, {
      ...options,
      // Required for the httpOnly auth cookie to travel cross-origin.
      // Without this the browser silently omits it and everything 401s.
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Could not reach the API gateway. Is it running?');
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message || res.statusText || 'Request failed';
    throw new ApiError(body?.statusCode ?? res.status, message, body?.path);
  }

  return body as T;
}

export const api = {
  // The caller (PlaceOrderPage) generates one key per submit attempt and
  // passes it in so that a double-click firing two requests before the
  // button disables, or a caller-side retry, reuses the same key — the
  // whole point of idempotency is that a fresh key per *call* would defeat
  // it. Falls back to generating one here only for callers that don't care.
  createOrder(input: CreateOrderInput, idempotencyKey?: string): Promise<Order> {
    return request<Order>('/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey ?? crypto.randomUUID() },
      body: JSON.stringify(input),
    });
  },

  getOrder(id: string): Promise<Order> {
    return request<Order>(`/orders/${encodeURIComponent(id)}`);
  },

  listOrders(params: {
    status?: string;
    customerEmail?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<PaginatedOrders> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.customerEmail) query.set('customerEmail', params.customerEmail);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<PaginatedOrders>(`/orders${qs ? `?${qs}` : ''}`);
  },

  cancelOrder(id: string): Promise<Order> {
    return request<Order>(`/orders/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    });
  },

  getStock(productId: string): Promise<InventoryItem> {
    return request<InventoryItem>(`/inventory/${encodeURIComponent(productId)}`);
  },

  login(credentials: Credentials): Promise<{ user: AuthUser }> {
    return request<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  register(credentials: Credentials): Promise<{ user: AuthUser }> {
    return request<{ user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  logout(): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/auth/logout', { method: 'POST' });
  },

  // Resolves to null rather than throwing on 401. A logged-out visitor is
  // the expected case for this probe, and throwing would make the bootstrap
  // path indistinguishable from a real failure.
  async me(): Promise<AuthUser | null> {
    try {
      const result = await request<{ user: AuthUser }>('/auth/me');
      return result.user;
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) return null;
      throw err;
    }
  },
};
