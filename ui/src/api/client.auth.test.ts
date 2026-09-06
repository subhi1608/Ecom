import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { api } from './client';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('api auth methods', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ user: { id: 'u1', email: 'a@b.com' } })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends credentials on every request so the cookie is included', async () => {
    await api.login({ email: 'a@b.com', password: 'supersecret' });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options?.credentials).toBe('include');
  });

  it('posts login credentials to /auth/login', async () => {
    const result = await api.login({ email: 'a@b.com', password: 'supersecret' });

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('/auth/login');
    expect(options?.method).toBe('POST');
    expect(result).toEqual({ user: { id: 'u1', email: 'a@b.com' } });
  });

  it('treats a 401 from /auth/me as "logged out", not as an error to surface', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ statusCode: 401, message: 'Not authenticated' }, 401));

    const result = await api.me();

    // Must resolve to null rather than throw — a logged-out visitor hitting
    // the bootstrap probe is the expected case, and throwing here is what
    // produces the /login -> /auth/me -> /login redirect loop.
    expect(result).toBeNull();
  });

  it('returns the user from /auth/me when authenticated', async () => {
    const result = await api.me();

    expect(result).toEqual({ id: 'u1', email: 'a@b.com' });
  });
});
