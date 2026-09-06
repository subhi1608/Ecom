import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import type { AuthStatus } from '../auth/AuthContext';

const authState = { status: 'loading' as AuthStatus, user: null as unknown };

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => authState,
}));

function renderAt(status: AuthStatus) {
  authState.status = status;
  return render(
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/secret" element={<p>Secret content</p>} />
        </Route>
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('does not redirect to login while auth is still loading', () => {
    renderAt('loading');

    // The whole point of the three-state model: redirecting here would
    // flash the login page at an already-authenticated user on refresh.
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });

  it('renders the protected content when authenticated', () => {
    renderAt('authenticated');

    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });

  it('redirects to login when unauthenticated', () => {
    renderAt('unauthenticated');

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });
});
