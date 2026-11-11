import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { lazy, Suspense } from 'react';

const Inventory = lazy(() => import('./pages/Inventory').then(m => ({ default: m.Inventory })));
const POS = lazy(() => import('./pages/POS').then(m => ({ default: m.POS })));
const SalesHistory = lazy(() => import('./pages/SalesHistory').then(m => ({ default: m.SalesHistory })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Users = lazy(() => import('./pages/Users').then(m => ({ default: m.Users })));
const Config = lazy(() => import('./pages/Config').then(m => ({ default: m.Config })));
const NotificationLog = lazy(() => import('./pages/NotificationLog').then(m => ({ default: m.NotificationLog })));
const CashRegister = lazy(() => import('./pages/CashRegister').then(m => ({ default: m.CashRegister })));
const Customers = lazy(() => import('./pages/Customers').then(m => ({ default: m.Customers })));
const Purchases = lazy(() => import('./pages/Purchases').then(m => ({ default: m.Purchases })));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-brand-900 border-t-transparent rounded-full" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/inventario/*" element={<Suspense fallback={<PageLoader />}><Inventory /></Suspense>} />
              <Route path="/pos" element={<Suspense fallback={<PageLoader />}><POS /></Suspense>} />
              <Route path="/ventas/*" element={<Suspense fallback={<PageLoader />}><SalesHistory /></Suspense>} />
              <Route path="/reportes" element={<Suspense fallback={<PageLoader />}><Reports /></Suspense>} />
              <Route
                path="/usuarios"
                element={
                  <ProtectedRoute requireAdmin>
                    <Suspense fallback={<PageLoader />}><Users /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracion"
                element={
                  <ProtectedRoute requireAdmin>
                    <Suspense fallback={<PageLoader />}><Config /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notificaciones"
                element={
                  <ProtectedRoute requireAdmin>
                    <Suspense fallback={<PageLoader />}><NotificationLog /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/caja"
                element={
                  <Suspense fallback={<PageLoader />}><CashRegister /></Suspense>
                }
              />
              <Route
                path="/clientes"
                element={
                  <Suspense fallback={<PageLoader />}><Customers /></Suspense>
                }
              />
              <Route
                path="/compras"
                element={
                  <Suspense fallback={<PageLoader />}><Purchases /></Suspense>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
