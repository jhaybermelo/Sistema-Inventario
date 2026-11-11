import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../api/reports';
import { getPublicConfig } from '../api/config';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { TrendingUp, ShoppingCart, Package, AlertTriangle } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

function KPICard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string; subtitle?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-gray-500 truncate">{title}</p>
          <p className="text-lg sm:text-xl xl:text-2xl font-bold text-gray-900 mt-1 whitespace-nowrap tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1 hidden sm:block">{subtitle}</p>}
        </div>
        <div className={`hidden sm:block p-3 rounded-xl ${color} flex-shrink-0 ml-2`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });
  const { data: publicConfig } = useQuery({
    queryKey: ['config-public'],
    queryFn: getPublicConfig,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-4 border-brand-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  const money = (n: number) => `$${n.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

  const weekLabels = data?.week.map(d => {
    const date = new Date(d.date + 'T00:00:00');
    return date.toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
  }) ?? [];

  const weekRevenue = data?.week.map(d => parseFloat(d.total_revenue)) ?? [];

  const chartData = {
    labels: weekLabels,
    datasets: [{
      label: 'Ventas',
      data: weekRevenue,
      fill: true,
      backgroundColor: 'rgba(6, 78, 59, 0.1)',
      borderColor: '#064e3b',
      tension: 0.4,
      pointBackgroundColor: '#064e3b',
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c: { parsed: { y: number | null } }) => ` ${money(c.parsed.y ?? 0)}` } },
    },
    scales: { y: { beginAtZero: true, ticks: { callback: (v: string | number) => money(Number(v)) } } },
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex items-center gap-4">
        {publicConfig?.logo_url && (
          <img
            src={publicConfig.logo_url}
            alt="Logo"
            className="h-16 w-16 object-contain rounded-xl bg-white shadow-sm border border-gray-100 p-1.5 flex-shrink-0"
          />
        )}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {publicConfig?.business_name ?? 'Dashboard'}
          </h2>
          <p className="text-gray-500 text-sm">Resumen de hoy</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <KPICard
          title="Ventas de Hoy"
          value={money(parseFloat(data?.today.total_revenue ?? '0'))}
          subtitle="Total acumulado"
          icon={TrendingUp}
          color="bg-brand-900"
        />
        <KPICard
          title="Transacciones"
          value={String(data?.today.transaction_count ?? 0)}
          subtitle="Ventas realizadas hoy"
          icon={ShoppingCart}
          color="bg-sky-600"
        />
        <KPICard
          title="Stock Bajo"
          value={String(data?.low_stock_count ?? 0)}
          subtitle="Productos a reponer"
          icon={AlertTriangle}
          color="bg-yellow-500"
        />
        <KPICard
          title="Promedio"
          value={money(
            (data?.today.transaction_count ?? 0) > 0
              ? parseFloat(data!.today.total_revenue) / data!.today.transaction_count
              : 0
          )}
          subtitle="Por transacción"
          icon={Package}
          color="bg-violet-600"
        />
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Ventas — Últimos 7 días</h3>
        <div className="h-64 sm:h-80"><Line data={chartData} options={chartOptions} /></div>
      </div>
    </div>
  );
}
