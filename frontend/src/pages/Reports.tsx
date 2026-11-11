import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getDashboard, getDailyProfit, getMonthlyProfit, getRangeProfit,
  downloadDailyPDF, downloadDailyDOCX,
  downloadMonthlyPDF, downloadMonthlyDOCX,
  downloadRangePDF, downloadRangeDOCX,
} from '../api/reports';
import type { PeriodSummary } from '../api/reports';
import { Button } from '../components/ui/Button';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { FileText, FileDown, TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function fmt(value: string | number) {
  return `$${Number(value).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function sumField(summary: PeriodSummary[], field: keyof PeriodSummary) {
  return summary.reduce((acc, s) => acc + Number(s[field]), 0);
}

// ── KPI cards ─────────────────────────────────────────────────────────────────

function ProfitCards({ summary }: { summary: PeriodSummary[] }) {
  const revenue = sumField(summary, 'total_revenue');
  const cost = sumField(summary, 'total_cost');
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const transactions = sumField(summary, 'transaction_count');

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-brand-50 rounded-xl p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-brand-900 mb-1">
          <DollarSign size={15} /> Ingresos
        </div>
        <div className="text-xl font-bold text-brand-900">{fmt(revenue)}</div>
        <div className="text-xs text-gray-500 mt-0.5">{transactions} transacciones</div>
      </div>
      <div className="bg-red-50 rounded-xl p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 mb-1">
          <TrendingDown size={15} /> Costo Total
        </div>
        <div className="text-xl font-bold text-red-600">{fmt(cost)}</div>
      </div>
      <div className={`${profit >= 0 ? 'bg-green-50' : 'bg-red-50'} rounded-xl p-4`}>
        <div className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          <TrendingUp size={15} /> Ganancia Bruta
        </div>
        <div className={`text-xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(profit)}</div>
      </div>
      <div className={`${margin >= 0 ? 'bg-green-50' : 'bg-red-50'} rounded-xl p-4`}>
        <div className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          <Percent size={15} /> Margen
        </div>
        <div className={`text-xl font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margin.toFixed(2)}%</div>
      </div>
    </div>
  );
}

// ── Day-by-day breakdown table ─────────────────────────────────────────────────

function DailyBreakdown({ summary, isAdmin }: { summary: PeriodSummary[]; isAdmin: boolean }) {
  const active = summary.filter(s => s.transaction_count > 0);
  if (active.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">Sin ventas registradas en este período</p>;
  }

  const totalRev = sumField(active, 'total_revenue');
  const totalCost = sumField(active, 'total_cost');
  const totalProfit = totalRev - totalCost;
  const totalMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-brand-900 text-white">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Fecha</th>
            <th className="px-3 py-2 text-right font-medium">Transacciones</th>
            <th className="px-3 py-2 text-right font-medium">Ingresos</th>
            {isAdmin && <th className="px-3 py-2 text-right font-medium">Costo</th>}
            {isAdmin && <th className="px-3 py-2 text-right font-medium">Ganancia</th>}
            {isAdmin && <th className="px-3 py-2 text-right font-medium">Margen %</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {active.map((s, i) => {
            const rev = Number(s.total_revenue);
            const cost = Number(s.total_cost);
            const profit = rev - cost;
            const margin = rev > 0 ? (profit / rev) * 100 : 0;
            return (
              <tr key={s.date} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 text-gray-700">{s.date}</td>
                <td className="px-3 py-2 text-right text-gray-600">{s.transaction_count}</td>
                <td className="px-3 py-2 text-right font-medium text-brand-900">{fmt(rev)}</td>
                {isAdmin && <td className="px-3 py-2 text-right text-red-600">{fmt(cost)}</td>}
                {isAdmin && (
                  <td className={`px-3 py-2 text-right font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(profit)}
                  </td>
                )}
                {isAdmin && (
                  <td className={`px-3 py-2 text-right ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {margin.toFixed(2)}%
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        {active.length > 1 && (
          <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
            <tr>
              <td className="px-3 py-2">TOTAL</td>
              <td className="px-3 py-2 text-right">{sumField(active, 'transaction_count')}</td>
              <td className="px-3 py-2 text-right text-brand-900">{fmt(totalRev)}</td>
              {isAdmin && <td className="px-3 py-2 text-right text-red-600">{fmt(totalCost)}</td>}
              {isAdmin && (
                <td className={`px-3 py-2 text-right ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmt(totalProfit)}
                </td>
              )}
              {isAdmin && (
                <td className={`px-3 py-2 text-right ${totalMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalMargin.toFixed(2)}%
                </td>
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type Tab = 'daily' | 'monthly' | 'range';

export function Reports() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const today = new Date().toISOString().split('T')[0];
  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth() + 1;

  const [tab, setTab] = useState<Tab>('daily');
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedYear, setSelectedYear] = useState(nowYear);
  const [selectedMonth, setSelectedMonth] = useState(nowMonth);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [downloading, setDownloading] = useState('');

  const { data: dashboard } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });

  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['profit-daily', selectedDate],
    queryFn: () => getDailyProfit(selectedDate),
    enabled: tab === 'daily',
  });

  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ['profit-monthly', selectedYear, selectedMonth],
    queryFn: () => getMonthlyProfit(selectedYear, selectedMonth),
    enabled: tab === 'monthly',
  });

  const rangeReady = tab === 'range' && !!dateFrom && !!dateTo;
  const { data: rangeData, isLoading: rangeLoading } = useQuery({
    queryKey: ['profit-range', dateFrom, dateTo],
    queryFn: () => getRangeProfit(dateFrom, dateTo),
    enabled: rangeReady,
  });

  const download = async (fn: () => Promise<void>, key: string) => {
    setDownloading(key);
    try { await fn(); }
    catch { toast.error('Error al generar el reporte'); }
    finally { setDownloading(''); }
  };

  const chartData = {
    labels: dashboard?.week.map(d => {
      const dt = new Date(d.date + 'T00:00:00');
      return dt.toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
    }) ?? [],
    datasets: [{
      label: 'Ingresos',
      data: dashboard?.week.map(d => parseFloat(d.total_revenue)) ?? [],
      backgroundColor: '#064e3b',
      borderRadius: 6,
    }],
  };

  const years = Array.from({ length: 5 }, (_, i) => nowYear - i);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'daily', label: 'Diario' },
    { key: 'monthly', label: 'Mensual' },
    { key: 'range', label: 'Rango de Fechas' },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">{isAdmin ? 'Reportes y Ganancias' : 'Reportes'}</h2>

      {/* Weekly chart */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Ingresos — Últimos 7 días</h3>
        <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
      </div>

      {/* Tabbed report panel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5',
                tab === t.key
                  ? 'border-brand-900 text-brand-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <FileText size={14} /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-5">

          {/* ── DAILY ─────────────────────────────────────────────────────── */}
          {tab === 'daily' && (
            <>
              <div className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Fecha</label>
                  <input type="date" value={selectedDate} max={today}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <Button variant="secondary" size="sm" loading={downloading === 'daily-pdf'}
                  onClick={() => download(() => downloadDailyPDF(selectedDate), 'daily-pdf')}>
                  <FileDown size={15} /> PDF
                </Button>
                <Button variant="secondary" size="sm" loading={downloading === 'daily-docx'}
                  onClick={() => download(() => downloadDailyDOCX(selectedDate), 'daily-docx')}>
                  <FileDown size={15} /> Word
                </Button>
              </div>
              {dailyLoading && <Spinner />}
              {dailyData && (
                <>
                  {isAdmin && <ProfitCards summary={dailyData.summary} />}
                  <DailyBreakdown summary={dailyData.summary} isAdmin={isAdmin} />
                </>
              )}
            </>
          )}

          {/* ── MONTHLY ───────────────────────────────────────────────────── */}
          {tab === 'monthly' && (
            <>
              <div className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Año</label>
                  <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Mes</label>
                  <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                    {MONTHS.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
                  </select>
                </div>
                <Button variant="secondary" size="sm" loading={downloading === 'monthly-pdf'}
                  onClick={() => download(() => downloadMonthlyPDF(selectedYear, selectedMonth), 'monthly-pdf')}>
                  <FileDown size={15} /> PDF
                </Button>
                <Button variant="secondary" size="sm" loading={downloading === 'monthly-docx'}
                  onClick={() => download(() => downloadMonthlyDOCX(selectedYear, selectedMonth), 'monthly-docx')}>
                  <FileDown size={15} /> Word
                </Button>
              </div>
              {monthlyLoading && <Spinner />}
              {monthlyData && (
                <>
                  {isAdmin && <ProfitCards summary={monthlyData.summary} />}
                  <DailyBreakdown summary={monthlyData.summary} isAdmin={isAdmin} />
                </>
              )}
            </>
          )}

          {/* ── RANGE ─────────────────────────────────────────────────────── */}
          {tab === 'range' && (
            <>
              <div className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Desde</label>
                  <input type="date" value={dateFrom} max={today}
                    onChange={e => setDateFrom(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Hasta</label>
                  <input type="date" value={dateTo} max={today}
                    onChange={e => setDateTo(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <Button variant="secondary" size="sm" disabled={!dateFrom || !dateTo}
                  loading={downloading === 'range-pdf'}
                  onClick={() => download(() => downloadRangePDF(dateFrom, dateTo), 'range-pdf')}>
                  <FileDown size={15} /> PDF
                </Button>
                <Button variant="secondary" size="sm" disabled={!dateFrom || !dateTo}
                  loading={downloading === 'range-docx'}
                  onClick={() => download(() => downloadRangeDOCX(dateFrom, dateTo), 'range-docx')}>
                  <FileDown size={15} /> Word
                </Button>
              </div>
              {!dateFrom || !dateTo
                ? <p className="text-sm text-gray-400 text-center py-4">Selecciona un rango de fechas para ver el resumen</p>
                : rangeLoading
                  ? <Spinner />
                  : rangeData && (
                    <>
                      {isAdmin && <ProfitCards summary={rangeData.summary} />}
                      <DailyBreakdown summary={rangeData.summary} isAdmin={isAdmin} />
                    </>
                  )
              }
            </>
          )}

        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="animate-spin h-6 w-6 border-4 border-brand-900 border-t-transparent rounded-full" />
    </div>
  );
}
