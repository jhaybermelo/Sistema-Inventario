import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getSales, getSale, cancelSale } from '../api/sales';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Printer, Search, X, UserRound } from 'lucide-react';
import { Pagination } from '../components/ui/Pagination';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

function paymentLabel(method: string) {
  return PAYMENT_LABELS[method] ?? method;
}

// ── Sales list ─────────────────────────────────────────────────────────────────

function SalesList() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const [saleNumber, setSaleNumber] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const hasFilters = saleNumber || dateFrom || dateTo || paymentMethod || statusFilter;

  const clearFilters = () => {
    setSaleNumber('');
    setDateFrom('');
    setDateTo('');
    setPaymentMethod('');
    setStatusFilter('');
    setPage(1);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['sales', saleNumber, dateFrom, dateTo, paymentMethod, statusFilter, page],
    queryFn: () => getSales({
      sale_number: saleNumber || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      payment_method: paymentMethod || undefined,
      status: statusFilter || undefined,
      page,
      size,
    }),
  });

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Historial de Ventas</h2>
          <p className="text-gray-500 text-sm">{data?.total ?? 0} ventas</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Filter bar */}
        <div className="p-3 sm:p-4 border-b border-gray-100 space-y-3">
          <div className="flex gap-2 sm:gap-3 flex-wrap items-end">
            {/* Sale number search */}
            <div className="flex-1 min-w-48">
              <label className="text-xs text-gray-500 block mb-1">N° de Factura</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={saleNumber}
                  onChange={e => { setSaleNumber(e.target.value); setPage(1); }}
                  placeholder="SALE-20260531-0001"
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Date from */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Desde</label>
              <input type="date" value={dateFrom} max={today}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            {/* Date to */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Hasta</label>
              <input type="date" value={dateTo} max={today}
                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            {/* Payment method */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Método de pago</label>
              <select value={paymentMethod} onChange={e => { setPaymentMethod(e.target.value); setPage(1); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Todos</option>
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Estado</label>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Todos</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={14} /> Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-brand-900 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="table-cards w-full text-sm min-w-[480px]">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">N° Factura</th>
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Cliente</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Método</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.items.map(s => (
                <tr
                  key={s.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/ventas/${s.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">{s.sale_number}</td>
                  <td data-label="Fecha" className="px-4 py-3 text-gray-600">{new Date(s.created_at).toLocaleString('es')}</td>
                  <td data-label="Cliente" className="px-4 py-3 hidden md:table-cell">
                    {s.customer_full_name
                      ? <span className="flex items-center gap-1 text-gray-700"><UserRound size={13} className="text-brand-400" />{s.customer_full_name}</span>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                  <td data-label="Método" className="px-4 py-3 text-gray-600 hidden sm:table-cell">{paymentLabel(s.payment_method)}</td>
                  <td data-label="Estado" className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {s.status === 'completed' ? 'Completada' : 'Cancelada'}
                    </span>
                  </td>
                  <td data-label="Total" className="px-4 py-3 text-right font-semibold">
                    ${parseFloat(s.total).toLocaleString('es', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    {hasFilters ? 'No se encontraron ventas con estos filtros' : 'No hay ventas registradas'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}

        <Pagination
          page={page}
          pages={data?.pages ?? 1}
          total={data?.total ?? 0}
          size={size}
          onPage={p => setPage(p)}
          onSizeChange={s => { setSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}

// ── Sale detail ────────────────────────────────────────────────────────────────

function SaleDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => getSale(Number(id)),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelSale(Number(id)),
    onSuccess: () => {
      toast.success('Venta cancelada');
      qc.invalidateQueries({ queryKey: ['sale', id] });
      qc.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: () => toast.error('Error al cancelar'),
  });

  if (isLoading) return (
    <div className="p-8 flex justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-brand-900 border-t-transparent rounded-full" />
    </div>
  );
  if (!sale) return <div className="p-8 text-gray-500">Venta no encontrada</div>;

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/ventas" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{sale.sale_number}</h2>
          <p className="text-gray-500 text-sm">{new Date(sale.created_at).toLocaleString('es')}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer size={16} /> Reimprimir
          </Button>
          {user?.role === 'admin' && sale.status === 'completed' && (
            <Button variant="danger" size="sm" loading={cancelMutation.isPending}
              onClick={() => { if (confirm('¿Cancelar esta venta?')) cancelMutation.mutate(); }}>
              Cancelar venta
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        {/* Items */}
        <table className="w-full text-sm mb-6">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Producto</th>
              <th className="text-center px-3 py-2 font-medium text-gray-600">Cant.</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Precio Unit.</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sale.items.map(item => (
              <tr key={item.id}>
                <td className="px-3 py-2">
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-xs text-gray-400">{item.product_sku}</p>
                </td>
                <td className="px-3 py-2 text-center">{item.quantity}</td>
                <td className="px-3 py-2 text-right">${parseFloat(item.unit_price).toLocaleString('es', { minimumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-right font-medium">${parseFloat(item.line_total).toLocaleString('es', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t border-gray-100 pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>${parseFloat(sale.subtotal).toLocaleString('es', { minimumFractionDigits: 2 })}</span>
          </div>
          {parseFloat(sale.tax_amount) > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Impuesto</span>
              <span>${parseFloat(sale.tax_amount).toLocaleString('es', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {parseFloat(sale.discount_amount) > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Descuento</span>
              <span>-${parseFloat(sale.discount_amount).toLocaleString('es', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-100">
            <span>Total</span>
            <span>${parseFloat(sale.total).toLocaleString('es', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500 pt-1">
            <span>Método de pago</span>
            <span>{paymentLabel(sale.payment_method)}</span>
          </div>
          {sale.customer_full_name && (
            <div className="flex justify-between text-xs text-gray-500 pt-1">
              <span className="flex items-center gap-1"><UserRound size={12} /> Cliente</span>
              <span className="font-medium text-gray-700">{sale.customer_full_name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Router ─────────────────────────────────────────────────────────────────────

export function SalesHistory() {
  return (
    <Routes>
      <Route index element={<SalesList />} />
      <Route path=":id" element={<SaleDetail />} />
    </Routes>
  );
}
