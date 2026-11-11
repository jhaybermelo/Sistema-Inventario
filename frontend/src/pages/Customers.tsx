import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Users, Plus, Pencil, Trash2, Search, X, ChevronRight,
  Phone, Mail, CreditCard, ShoppingBag, ArrowUpDown, ArrowUp, ArrowDown,
  Wallet, CheckCircle, Clock, AlertCircle,
} from 'lucide-react';
import { getCustomerCredits, addPayment, type CustomerCreditSummary, type CustomerCreditItem } from '../api/credits';
import {
  getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, getCustomerSales,
  type Customer, type CustomerListItem, type CustomerCreate,
} from '../api/customers';
import { Pagination } from '../components/ui/Pagination';
import type { Sale } from '../types';

const fmt = (v: string | number) =>
  new Intl.NumberFormat('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v));

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia',
};

// ── Customer Form Modal ───────────────────────────────────────────────────────

function CustomerFormModal({
  existing,
  onClose,
}: {
  existing: Customer | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!existing;

  const [form, setForm] = useState<CustomerCreate>({
    full_name: existing?.full_name ?? '',
    email: existing?.email ?? '',
    phone: existing?.phone ?? '',
    document_id: existing?.document_id ?? '',
    address: existing?.address ?? '',
    notes: existing?.notes ?? '',
  });

  const set = (field: keyof CustomerCreate) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? updateCustomer(existing!.id, form)
      : createCustomer(form),
    onSuccess: () => {
      toast.success(isEdit ? 'Cliente actualizado' : 'Cliente creado');
      qc.invalidateQueries({ queryKey: ['customers'] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Error al guardar';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error('El nombre es obligatorio'); return; }
    mutation.mutate();
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
  const labelCls = 'text-xs font-medium text-gray-600 block mb-1';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Editar cliente' : 'Nuevo cliente'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className={labelCls}>Nombre completo <span className="text-red-500">*</span></label>
            <input type="text" className={inputCls} value={form.full_name} onChange={set('full_name')} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Teléfono</label>
              <input type="tel" className={inputCls} value={form.phone ?? ''} onChange={set('phone')} placeholder="Ej: 3001234567" />
            </div>
            <div>
              <label className={labelCls}>Documento (cédula/NIT)</label>
              <input type="text" className={inputCls} value={form.document_id ?? ''} onChange={set('document_id')} placeholder="Ej: 12345678" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={form.email ?? ''} onChange={set('email')} placeholder="correo@ejemplo.com" />
          </div>
          <div>
            <label className={labelCls}>Dirección</label>
            <input type="text" className={inputCls} value={form.address ?? ''} onChange={set('address')} placeholder="Calle, barrio…" />
          </div>
          <div>
            <label className={labelCls}>Notas</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={form.notes ?? ''}
              onChange={set('notes')}
              placeholder="Observaciones adicionales…"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-brand-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-brand-800 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Credit row with payment form ──────────────────────────────────────────────

const CREDIT_STATUS: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: { label: 'Pendiente', cls: 'bg-red-100 text-red-700',    icon: <AlertCircle size={11} /> },
  partial: { label: 'Parcial',   cls: 'bg-amber-100 text-amber-700', icon: <Clock size={11} /> },
  paid:    { label: 'Pagado',    cls: 'bg-green-100 text-green-700', icon: <CheckCircle size={11} /> },
};

function CreditRow({ credit, customerId }: { credit: CustomerCreditItem; customerId: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');

  const mutation = useMutation({
    mutationFn: () => addPayment(credit.id, { amount, payment_method: method }),
    onSuccess: () => {
      toast.success('Abono registrado');
      setAmount(''); setOpen(false);
      qc.invalidateQueries({ queryKey: ['customer-credits', customerId] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Error al registrar abono'),
  });

  const cfg = CREDIT_STATUS[credit.status] ?? CREDIT_STATUS.pending;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden mb-3">
      <div className="flex items-center justify-between p-3 bg-gray-50">
        <div>
          <p className="text-sm font-medium text-gray-900">{credit.sale_number}</p>
          <p className="text-xs text-gray-400">{fmtDate(credit.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
            {cfg.icon} {cfg.label}
          </span>
        </div>
      </div>
      <div className="p-3 grid grid-cols-3 text-center text-xs divide-x divide-gray-100">
        <div><p className="font-bold text-gray-900">${fmt(credit.original_amount)}</p><p className="text-gray-400 mt-0.5">Crédito</p></div>
        <div><p className="font-bold text-green-700">${fmt(credit.paid_amount)}</p><p className="text-gray-400 mt-0.5">Abonado</p></div>
        <div><p className={`font-bold ${Number(credit.balance) > 0 ? 'text-red-600' : 'text-gray-400'}`}>${fmt(credit.balance)}</p><p className="text-gray-400 mt-0.5">Saldo</p></div>
      </div>
      {credit.status !== 'paid' && (
        <div className="px-3 pb-3">
          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className="w-full text-xs font-medium text-brand-900 border border-brand-200 rounded-lg py-1.5 hover:bg-brand-50 transition-colors"
            >
              + Registrar abono
            </button>
          ) : (
            <div className="bg-brand-50 rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                  <input type="number" min="0.01" step="0.01" max={credit.balance}
                    value={amount} onChange={e => setAmount(e.target.value)} autoFocus
                    placeholder={`Máx $${fmt(credit.balance)}`}
                    className="w-full border border-gray-300 rounded-lg pl-5 pr-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <select value={method} onChange={e => setMethod(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} className="flex-1 text-xs border border-gray-300 rounded-lg py-1.5 hover:bg-gray-50 transition-colors">Cancelar</button>
                <button onClick={() => mutation.mutate()} disabled={!amount || mutation.isPending}
                  className="flex-1 text-xs bg-brand-900 text-white rounded-lg py-1.5 hover:bg-brand-800 disabled:opacity-50 transition-colors">
                  {mutation.isPending ? 'Guardando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Customer History Drawer ───────────────────────────────────────────────────

function CustomerDrawer({
  customerId,
  onClose,
  onEdit,
}: {
  customerId: number;
  onClose: () => void;
  onEdit: (c: Customer) => void;
}) {
  const [tab, setTab] = useState<'sales' | 'credits'>('sales');
  const [salesPage, setSalesPage] = useState(1);

  const { data: customer, isLoading: loadingCustomer } = useQuery<Customer>({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomer(customerId),
  });

  const { data: salesData } = useQuery({
    queryKey: ['customer-sales', customerId, salesPage],
    queryFn: () => getCustomerSales(customerId, { page: salesPage, size: 10 }),
    enabled: tab === 'sales',
  });

  const { data: creditsData } = useQuery<CustomerCreditSummary>({
    queryKey: ['customer-credits', customerId],
    queryFn: () => getCustomerCredits(customerId),
    enabled: tab === 'credits',
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-brand-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-700 flex items-center justify-center font-bold text-lg">
              {customer?.full_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="font-bold text-base leading-tight">{customer?.full_name ?? '…'}</p>
              {customer?.document_id && <p className="text-brand-300 text-xs">{customer.document_id}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {customer && (
              <button onClick={() => onEdit(customer)} className="p-1.5 rounded-lg hover:bg-brand-800 transition-colors" title="Editar">
                <Pencil size={16} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-800 transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingCustomer ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-brand-900 border-t-transparent rounded-full" />
            </div>
          ) : customer ? (
            <>
              {/* Contact info */}
              <div className="p-4 border-b border-gray-100 space-y-1.5 text-sm text-gray-600">
                {customer.phone && <div className="flex items-center gap-2"><Phone size={13} className="text-gray-400" />{customer.phone}</div>}
                {customer.email && <div className="flex items-center gap-2"><Mail size={13} className="text-gray-400" />{customer.email}</div>}
                {customer.address && <div className="flex items-center gap-2"><CreditCard size={13} className="text-gray-400" />{customer.address}</div>}
                {customer.notes && <p className="text-gray-500 text-xs bg-gray-50 rounded-lg p-2">{customer.notes}</p>}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                <div className="p-3 text-center"><p className="text-xl font-bold text-gray-900">{customer.total_purchases}</p><p className="text-xs text-gray-400">Compras</p></div>
                <div className="p-3 text-center"><p className="text-xl font-bold text-brand-900">${fmt(customer.total_spent)}</p><p className="text-xs text-gray-400">Gastado</p></div>
                <div className="p-3 text-center"><p className="text-sm font-semibold text-gray-700">{customer.last_purchase_at ? fmtDate(customer.last_purchase_at) : '—'}</p><p className="text-xs text-gray-400">Última compra</p></div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100">
                <button onClick={() => setTab('sales')} className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${tab === 'sales' ? 'border-b-2 border-brand-900 text-brand-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  <ShoppingBag size={14} /> Compras
                </button>
                <button onClick={() => setTab('credits')} className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${tab === 'credits' ? 'border-b-2 border-brand-900 text-brand-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Wallet size={14} /> Créditos
                  {creditsData && Number(creditsData.total_balance) > 0 && (
                    <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">${fmt(creditsData.total_balance)}</span>
                  )}
                </button>
              </div>

              {/* Sales tab */}
              {tab === 'sales' && (
                <div className="p-4 space-y-2">
                  {salesData?.items?.length === 0 && <p className="text-gray-400 text-sm text-center py-6">Sin compras registradas</p>}
                  {salesData?.items?.map((sale: Sale) => (
                    <div key={sale.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{sale.sale_number}</p>
                        <p className="text-xs text-gray-400">{fmtDate(sale.created_at)} · {PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}</p>
                        {Number(sale.credit_amount) > 0 && (
                          <p className="text-xs text-amber-600 mt-0.5">Crédito: ${fmt(sale.credit_amount)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">${fmt(sale.total)}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${sale.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {sale.status === 'completed' ? 'Completada' : 'Cancelada'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {salesData && salesData.pages > 1 && (
                    <div className="flex justify-center gap-2 pt-2">
                      <button disabled={salesPage === 1} onClick={() => setSalesPage(p => p - 1)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">Anterior</button>
                      <span className="px-3 py-1.5 text-xs text-gray-500">{salesPage}/{salesData.pages}</span>
                      <button disabled={salesPage === salesData.pages} onClick={() => setSalesPage(p => p + 1)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">Siguiente</button>
                    </div>
                  )}
                </div>
              )}

              {/* Credits tab */}
              {tab === 'credits' && (
                <div className="p-4">
                  {creditsData && (
                    <>
                      {/* Summary */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <p className="text-base font-bold text-gray-900">${fmt(creditsData.total_credit)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Total crédito</p>
                        </div>
                        <div className="bg-green-50 rounded-xl p-3 text-center">
                          <p className="text-base font-bold text-green-700">${fmt(creditsData.total_paid)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Total abonado</p>
                        </div>
                        <div className={`rounded-xl p-3 text-center ${Number(creditsData.total_balance) > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                          <p className={`text-base font-bold ${Number(creditsData.total_balance) > 0 ? 'text-red-600' : 'text-gray-400'}`}>${fmt(creditsData.total_balance)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Saldo pendiente</p>
                        </div>
                      </div>

                      {creditsData.credits.length === 0 && (
                        <p className="text-gray-400 text-sm text-center py-6">Sin créditos registrados</p>
                      )}
                      {creditsData.credits.map(credit => (
                        <CreditRow key={credit.id} credit={credit} customerId={customerId} />
                      ))}
                    </>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function Customers() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [showInactive, setShowInactive] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [modal, setModal] = useState<'none' | 'create' | 'edit'>('none');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [drawerCustomerId, setDrawerCustomerId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', q, page, size, showInactive, sortBy, sortDir],
    queryFn: () => getCustomers({ q: q || undefined, page, size, show_inactive: showInactive, sort_by: sortBy, sort_dir: sortDir }),
  });

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown size={13} className="text-gray-300" />;
    return sortDir === 'asc'
      ? <ArrowUp size={13} className="text-brand-900" />
      : <ArrowDown size={13} className="text-brand-900" />;
  };

  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      toast.success('Cliente desactivado');
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: () => toast.error('Error al eliminar el cliente'),
  });

  const handleDelete = (customer: CustomerListItem) => {
    if (!confirm(`¿Desactivar al cliente "${customer.full_name}"?`)) return;
    deleteMutation.mutate(customer.id);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setModal('edit');
    setDrawerCustomerId(null);
  };

  const closeModal = () => {
    setModal('none');
    setEditingCustomer(null);
  };

  const renderActions = (customer: CustomerListItem) => (
    <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => setDrawerCustomerId(customer.id)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-900 hover:bg-brand-50 transition-colors"
          title="Ver historial"
        >
          <ChevronRight size={15} />
        </button>
        <button
          onClick={async () => {
            const full = await getCustomer(customer.id);
            openEdit(full);
          }}
          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-900 hover:bg-brand-50 transition-colors"
          title="Editar"
        >
          <Pencil size={15} />
        </button>
        {customer.is_active && (
          <button
            onClick={() => handleDelete(customer)}
            disabled={deleteMutation.isPending}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
            title="Desactivar"
          >
            <Trash2 size={15} />
          </button>
        )}
    </div>
  );

  return (
    <div className="p-4 sm:p-8">

      {/* Modals / Drawer */}
      {(modal === 'create' || modal === 'edit') && (
        <CustomerFormModal existing={editingCustomer} onClose={closeModal} />
      )}
      {drawerCustomerId && (
        <CustomerDrawer
          customerId={drawerCustomerId}
          onClose={() => setDrawerCustomerId(null)}
          onEdit={openEdit}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={22} /> Clientes
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.total ?? 0} cliente{data?.total !== 1 ? 's' : ''} registrado{data?.total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="flex items-center gap-2 bg-brand-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-800 transition-colors"
        >
          <Plus size={16} /> Nuevo cliente
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1); }}
              placeholder="Buscar por nombre, teléfono, documento, email…"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {q && (
              <button
                onClick={() => { setQ(''); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ordenar por</label>
            <div className="flex gap-1">
              <select
                value={sortBy}
                onChange={e => { setSortBy(e.target.value); setSortDir(e.target.value === 'name' ? 'asc' : 'desc'); setPage(1); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="name">Nombre</option>
                <option value="purchases">N° Compras</option>
                <option value="spent">Total Gastado</option>
                <option value="created_at">Fecha registro</option>
              </select>
              <button
                onClick={() => { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); setPage(1); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
              >
                {sortDir === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none mt-4">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => { setShowInactive(e.target.checked); setPage(1); }}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Mostrar inactivos
          </label>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-brand-900 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
          {/* Móvil: tarjetas */}
          <div className="md:hidden divide-y divide-gray-100">
            {data?.items.map(customer => (
              <div
                key={customer.id}
                className="p-4 cursor-pointer active:bg-gray-50"
                onClick={() => setDrawerCustomerId(customer.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-900 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {customer.full_name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{customer.full_name}</p>
                        {customer.document_id && <p className="text-xs text-gray-400">{customer.document_id}</p>}
                      </div>
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                        customer.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {customer.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    {(customer.phone || customer.email) && (
                      <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                        {customer.phone && <p className="flex items-center gap-1"><Phone size={11} /> {customer.phone}</p>}
                        {customer.email && <p className="flex items-center gap-1 break-all"><Mail size={11} /> {customer.email}</p>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      <ShoppingBag size={13} className="text-gray-400" />
                      {customer.total_purchases}
                    </span>
                    <span className="font-semibold text-gray-900">${fmt(customer.total_spent)}</span>
                  </div>
                  {renderActions(customer)}
                </div>
              </div>
            ))}
            {data?.items.length === 0 && (
              <p className="px-4 py-12 text-center text-gray-400">
                {q ? 'No se encontraron clientes con esa búsqueda' : 'No hay clientes registrados'}
              </p>
            )}
          </div>

          {/* Escritorio: tabla */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-gray-900 transition-colors">
                      Cliente <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Contacto</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    <button onClick={() => toggleSort('purchases')} className="flex items-center gap-1 ml-auto hover:text-gray-900 transition-colors">
                      Compras <SortIcon field="purchases" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    <button onClick={() => toggleSort('spent')} className="flex items-center gap-1 ml-auto hover:text-gray-900 transition-colors">
                      Total gastado <SortIcon field="spent" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.items.map(customer => (
                  <tr
                    key={customer.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setDrawerCustomerId(customer.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-900 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {customer.full_name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{customer.full_name}</p>
                          {customer.document_id && (
                            <p className="text-xs text-gray-400">{customer.document_id}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                      {customer.phone && <p className="flex items-center gap-1"><Phone size={11} /> {customer.phone}</p>}
                      {customer.email && <p className="flex items-center gap-1 mt-0.5"><Mail size={11} /> {customer.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      <span className="inline-flex items-center gap-1">
                        <ShoppingBag size={13} className="text-gray-400" />
                        {customer.total_purchases}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      ${fmt(customer.total_spent)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        customer.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {customer.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      {renderActions(customer)}
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                      {q ? 'No se encontraron clientes con esa búsqueda' : 'No hay clientes registrados'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </>
        )}

        <Pagination
          page={page}
          pages={data?.pages ?? 1}
          total={data?.total ?? 0}
          size={size}
          onPage={setPage}
          onSizeChange={s => { setSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}
