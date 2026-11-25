import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { EntryScreen } from './screens/EntryScreen';
import { ActiveOrdersScreen } from './screens/employee/ActiveOrdersScreen';
import { OrderChecklistScreen } from './screens/employee/OrderChecklistScreen';
import { NewOrderScreen } from './screens/employee/NewOrderScreen';
import { ManagerDashboardScreen } from './screens/manager/ManagerDashboardScreen';
import { ManagerOrdersScreen } from './screens/manager/ManagerOrdersScreen';
import { RoleGuard } from './routes/RoleGuard';
import { ToastHost } from './components/ui/Toast';
import { ConnectionBanner } from './components/ui/ConnectionBanner';
import { CodeScreen } from './screens/CodeScreen';
import { he } from './i18n/he';
import { useOrders } from './store/ordersStore';
import { useSession } from './store/sessionStore';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Home() {
  const role = useSession((s) => s.role);
  if (role === 'manager') return <Navigate to="/manager" replace />;
  if (role === 'employee') return <Navigate to="/orders" replace />;
  return <EntryScreen />;
}

export default function App() {
  const { loaded, load, needsCode, error } = useOrders();

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <ToastHost />
      <ConnectionBanner />
      <div className="mx-auto min-h-dvh max-w-md bg-slate-50">
        {needsCode ? (
          <CodeScreen />
        ) : !loaded ? (
          <p className="p-10 text-center text-2xl text-slate-600">{error ? he.connection.loadFailed : he.connection.loading}</p>
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route element={<RoleGuard allow={['employee', 'manager']} />}>
              <Route path="/orders" element={<ActiveOrdersScreen />} />
              <Route path="/orders/new" element={<NewOrderScreen />} />
              <Route path="/orders/:id" element={<OrderChecklistScreen />} />
            </Route>
            <Route element={<RoleGuard allow={['manager']} />}>
              <Route path="/manager" element={<ManagerDashboardScreen />} />
              <Route path="/manager/orders/:filter" element={<ManagerOrdersScreen />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
    </BrowserRouter>
  );
}
