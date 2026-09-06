import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginPage } from './LoginPage';
import { ApiError } from '../api/client';

const login = vi.fn();

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ login, status: 'unauthenticated', user: null }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    login.mockReset();
  });

  it('submits the entered credentials', async () => {
    login.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'supersecret' });
  });

  it('shows the API error message when the credentials are rejected', async () => {
    login.mockRejectedValue(new ApiError(401, 'Invalid email or password'));
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument(),
    );
  });

  it('returns the user to the route they were originally trying to reach', async () => {
    login.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/inventory' } }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/inventory" element={<p>Inventory page</p>} />
          <Route path="/" element={<p>Home page</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Must land on /inventory, not the home page — otherwise the
    // ProtectedRoute's `state.from` plumbing is decorative.
    await waitFor(() => expect(screen.getByText('Inventory page')).toBeInTheDocument());
    expect(screen.queryByText('Home page')).not.toBeInTheDocument();
  });
});
