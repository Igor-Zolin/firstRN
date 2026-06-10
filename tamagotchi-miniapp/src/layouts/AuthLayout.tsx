import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function AuthLayout() {
  const { isAuthed, bootLoading } = useAuth();

  if (bootLoading) {
    return <div className="screen-loading">Connecting...</div>;
  }

  if (isAuthed) return <Navigate to="/" replace />;

  return <Outlet />;
}
