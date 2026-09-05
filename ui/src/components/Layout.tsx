import { NavLink, Outlet } from 'react-router-dom';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-slate-900 text-white'
      : 'text-slate-600 hover:bg-slate-200'
  }`;

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-slate-900">Ecom Console</span>
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
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
