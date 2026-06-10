import { useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { AuthLayout } from './layouts/AuthLayout';
import { TabsLayout } from './layouts/TabsLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { HomePage } from './pages/tabs/HomePage';
import { MarketPage } from './pages/tabs/MarketPage';
import { ProfilePage } from './pages/tabs/ProfilePage';
import { ShopPage } from './pages/tabs/ShopPage';
import {
  initTelegramMiniApp,
  subscribeTelegramBackButton,
} from './lib/telegram';

function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    initTelegramMiniApp();
  }, []);

  useEffect(() => {
    return subscribeTelegramBackButton(
      location.pathname !== '/',
      () => navigate(-1)
    );
  }, [location.pathname, navigate]);

  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<RootLayout />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            <Route element={<TabsLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
