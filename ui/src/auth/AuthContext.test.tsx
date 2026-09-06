import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { api } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    api: { me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() },
  };
});

function Probe() {
  const { status, user, logout } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{user?.email ?? 'none'}</span>
      <button onClick={() => logout()}>Sign out</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.mocked(api.me).mockReset();
    vi.mocked(api.logout).mockReset();
  });

  it('starts in loading before the /auth/me probe resolves', async () => {
    let resolveMe: (v: unknown) => void = () => {};
    vi.mocked(api.me).mockReturnValue(new Promise((r) => { resolveMe = r; }) as never);

    renderProbe();

    // This is the state that prevents a login-page flash on refresh.
    expect(screen.getByTestId('status')).toHaveTextContent('loading');

    resolveMe(null);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
  });

  it('becomes authenticated when the probe returns a user', async () => {
    vi.mocked(api.me).mockResolvedValue({ id: 'u1', email: 'a@b.com' });

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('email')).toHaveTextContent('a@b.com');
  });

  it('becomes unauthenticated when the probe returns null', async () => {
    vi.mocked(api.me).mockResolvedValue(null);

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(screen.getByTestId('email')).toHaveTextContent('none');
  });

  it('clears the user on logout', async () => {
    vi.mocked(api.me).mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    vi.mocked(api.logout).mockResolvedValue({ success: true });

    const user = userEvent.setup();
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(api.logout).toHaveBeenCalled();
  });
});
