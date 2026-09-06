import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
  }`;

export function Layout() {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-slate-900">Ecom Console</span>

          {status === 'authenticated' && (
            <nav className="flex gap-1">
              <NavLink to="/" end className={navLinkClass}>
                Place Order
              </NavLink>
              <NavLink to="/orders/list" className={navLinkClass}>
                Orders
              </NavLink>
              <NavLink to="/orders" end className={navLinkClass}>
                Find Order
              </NavLink>
              <NavLink to="/inventory" className={navLinkClass}>
                Inventory
              </NavLink>
            </nav>
          )}

          {status === 'authenticated' && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
