import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getLowStockCount } from '../api/products';
import { getPublicConfig } from '../api/config';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Package, ShoppingCart, History, FileBarChart,
  Users, Settings, LogOut, AlertTriangle, Menu, X, Bell, DollarSign, UserRound, Truck,
} from 'lucide-react';

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventario', icon: Package, label: 'Inventario' },
  { to: '/pos', icon: ShoppingCart, label: 'Punto de Venta' },
  { to: '/caja', icon: DollarSign, label: 'Caja' },
  { to: '/clientes', icon: UserRound, label: 'Clientes' },
  { to: '/compras', icon: Truck, label: 'Compras' },
  { to: '/ventas', icon: History, label: 'Historial' },
  { to: '/reportes', icon: FileBarChart, label: 'Reportes' },
];

const adminNav = [
  { to: '/usuarios', icon: Users, label: 'Usuarios' },
  { to: '/notificaciones', icon: Bell, label: 'Notificaciones' },
  { to: '/configuracion', icon: Settings, label: 'Configuración' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: lowStockCount } = useQuery({
    queryKey: ['low-stock-count'],
    queryFn: getLowStockCount,
    refetchInterval: 60000,
  });

  const { data: publicConfig } = useQuery({
    queryKey: ['config-public'],
    queryFn: getPublicConfig,
    staleTime: 5 * 60 * 1000,
  });

  const closeSidebar = () => setSidebarOpen(false);

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-brand-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {publicConfig?.logo_url ? (
            <img
              src={publicConfig.logo_url}
              alt="Logo"
              className="h-10 w-10 object-contain rounded-lg bg-white/10 flex-shrink-0 p-0.5"
            />
          ) : null}
          <div className="min-w-0">
            <h1 className="text-sm font-bold leading-tight truncate">
              {publicConfig?.business_name ?? 'Droguería Central'}
            </h1>
            <p className="text-brand-300 text-xs mt-0.5 truncate">{user?.full_name}</p>
          </div>
        </div>
        <button
          className="lg:hidden text-brand-300 hover:text-white p-1 flex-shrink-0"
          onClick={closeSidebar}
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            onClick={closeSidebar}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              location.pathname.startsWith(to)
                ? 'bg-brand-700 text-white'
                : 'text-brand-200 hover:bg-brand-800 hover:text-white'
            )}
          >
            <Icon size={18} />
            <span>{label}</span>
            {to === '/inventario' && (lowStockCount ?? 0) > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {lowStockCount}
              </span>
            )}
          </Link>
        ))}

        {user?.role === 'admin' && (
          <>
            <div className="pt-4 pb-1.5">
              <p className="text-brand-400 text-xs uppercase tracking-wider px-3">Admin</p>
            </div>
            {adminNav.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                onClick={closeSidebar}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  location.pathname.startsWith(to)
                    ? 'bg-brand-700 text-white'
                    : 'text-brand-200 hover:bg-brand-800 hover:text-white'
                )}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      {(lowStockCount ?? 0) > 0 && (
        <div className="mx-3 mb-2 p-3 bg-yellow-500/20 border border-yellow-500/40 rounded-lg flex items-center gap-2 text-yellow-300 text-xs">
          <AlertTriangle size={15} />
          <span>{lowStockCount} producto{lowStockCount !== 1 ? 's' : ''} con stock bajo</span>
        </div>
      )}

      <div className="p-3 border-t border-brand-800">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-brand-200 hover:bg-brand-800 hover:text-white transition-colors w-full"
        >
          <LogOut size={18} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Mobile overlay */}
      <div
        aria-hidden="true"
        className={clsx(
          'fixed inset-0 bg-black/50 z-20 lg:hidden transition-opacity duration-200 ease-out',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeSidebar}
      />

      {/* Sidebar — drawer on mobile, fixed on desktop */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-30 w-64 bg-brand-900 text-white flex flex-col transition-transform duration-250 ease-drawer',
        'lg:relative lg:translate-x-0 lg:flex-shrink-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {sidebarContent}
      </aside>

      {/* Right side */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 bg-brand-900 text-white flex-shrink-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-brand-800 transition-colors"
          >
            <Menu size={22} />
          </button>
          {publicConfig?.logo_url && (
            <img src={publicConfig.logo_url} alt="Logo" className="h-8 w-8 object-contain rounded bg-white/10 p-0.5" />
          )}
          <span className="font-bold text-sm flex-1 truncate">
            {publicConfig?.business_name ?? 'Droguería Central'}
          </span>
          {(lowStockCount ?? 0) > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle size={12} /> {lowStockCount}
            </span>
          )}
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
