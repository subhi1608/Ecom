import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (status === 'unauthenticated') {
    // `replace` so the Back button doesn't bounce the user straight back
    // into the guarded route. `state.from` lets login return them here.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
