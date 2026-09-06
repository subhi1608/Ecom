import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PlaceOrderPage } from './pages/PlaceOrderPage';
import { FindOrderPage } from './pages/FindOrderPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrdersListPage } from './pages/OrdersListPage';
import { InventoryPage } from './pages/InventoryPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />

            <Route element={<ProtectedRoute />}>
              <Route index element={<PlaceOrderPage />} />
              <Route path="orders" element={<FindOrderPage />} />
              <Route path="orders/list" element={<OrdersListPage />} />
              <Route path="orders/:id" element={<OrderDetailPage />} />
              <Route path="inventory" element={<InventoryPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
