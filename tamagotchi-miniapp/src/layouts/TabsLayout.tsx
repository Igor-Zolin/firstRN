import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const tabs = [
  { to: '/', label: 'Home', icon: 'house.fill' },
  { to: '/shop', label: 'Shop', icon: 'cart.fill' },
  { to: '/market', label: 'Market', icon: 'paperplane.fill' },
  { to: '/profile', label: 'Profile', icon: 'cat.fill' },
];

export function TabsLayout() {
  const location = useLocation();
  const { isAuthed, bootLoading } = useAuth();

  if (bootLoading) {
    return <div className="screen-loading">Connecting...</div>;
  }

  if (!isAuthed) return <Navigate to="/login" replace />;

  return (
    <main className="page-shell">
      <section className="tabs-page-content">
        <Outlet />
      </section>

      <nav className="bottom-tabs" aria-label="Main tabs">
        {tabs.map((tab) => {
          const active = tab.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.to);

          return (
            <Link key={tab.to} to={tab.to} className={`bottom-tab ${active ? 'bottom-tab-active' : ''}`}>
              <span className="bottom-tab-icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="bottom-tab-label">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </main>
  );
}
