import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PlaceOrderPage } from './pages/PlaceOrderPage';
import { FindOrderPage } from './pages/FindOrderPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrdersListPage } from './pages/OrdersListPage';
import { InventoryPage } from './pages/InventoryPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<PlaceOrderPage />} />
          <Route path="orders" element={<FindOrderPage />} />
          <Route path="orders/list" element={<OrdersListPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="inventory" element={<InventoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
