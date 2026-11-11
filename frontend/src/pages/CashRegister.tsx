import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Wallet, Plus, Trash2, Lock, TrendingDown, Calculator,
  History as HistoryIcon, DollarSign, AlertCircle, CheckCircle,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Pagination } from '../components/ui/Pagination';

interface Expense {
  id: number;
  amount: string;
  description: string;
  created_at: string;
}

interface CashSession {
  id: number;
  user_id: number;
  user_full_name: string;
  opening_amount: string;
  closing_amount: string | null;
  expected_amount: string | null;
  difference: string | null;
  status: 'open' | 'closed';
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
  expenses: Expense[];
  cash_sales: string;
  total_expenses: string;
}

interface HistoryItem {
  id: number;
  user_full_name: string;
  opening_amount: string;
  closing_amount: string | null;
  expected_amount: string | null;
  difference: string | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
}

interface HistoryResponse {
  items: HistoryItem[];
  total: number;
  page: number;
  pages: number;
}

const fmt = (v: string | number | null | undefined) => {
  if (v == null) return '—';
  return new Intl.NumberFormat('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v));
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('es', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

function DifferenceChip({ value }: { value: string | null }) {
  if (value == null) return <span className="text-gray-400">—</span>;
  const n = Number(value);
  if (n === 0) return (
    <span className="inline-flex items-center gap-1 text-green-700 font-medium">
      <CheckCircle size={14} /> Cuadrado
    </span>
  );
  if (n > 0) return (
    <span className="inline-flex items-center gap-1 text-green-700 font-medium">
      +{fmt(value)} sobrante
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-red-600 font-medium">
      <AlertCircle size={14} /> {fmt(Math.abs(n))} faltante
    </span>
  );
}

function StatCard({ label, value, sub, color = 'gray' }: {
  label: string; value: string; sub?: string; color?: 'gray' | 'blue' | 'green' | 'red' | 'yellow';
}) {
  const colors = {
    gray: 'bg-gray-50 border-gray-200 text-gray-900',
    blue: 'bg-brand-50 border-brand-200 text-brand-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

// ── Open Session Form ─────────────────────────────────────────────────────────

function OpenSessionForm({ onOpen }: { onOpen: (amount: string) => void }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!amount || isNaN(n) || n < 0) {
      toast.error('Ingresa un monto de apertura válido');
      return;
    }
    setLoading(true);
    try {
      await onOpen(amount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mb-4">
          <Wallet size={32} className="text-brand-900" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">No tienes un turno abierto</h3>
        <p className="text-gray-500 text-sm mb-6">Registra el efectivo inicial para comenzar tu turno.</p>
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Monto de apertura
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                autoFocus
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Abriendo turno…' : 'Abrir Turno'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Close Session Modal ───────────────────────────────────────────────────────

function CloseModal({
  session,
  onClose,
  onCancel,
}: {
  session: CashSession;
  onClose: (amount: string, notes: string) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const expected = Number(session.opening_amount) + Number(session.cash_sales) - Number(session.total_expenses);
  const counted = Number(amount) || 0;
  const diff = amount ? counted - expected : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!amount || isNaN(n) || n < 0) {
      toast.error('Ingresa el monto contado');
      return;
    }
    setLoading(true);
    try {
      await onClose(amount, notes);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Lock size={18} /> Cerrar Turno
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Cuenta el efectivo en caja y registra el total.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Expected summary */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Apertura</span>
              <span className="font-medium">${fmt(session.opening_amount)}</span>
            </div>
            <div className="flex justify-between text-green-700">
              <span>+ Ventas en efectivo</span>
              <span className="font-medium">+${fmt(session.cash_sales)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>− Egresos</span>
              <span className="font-medium">−${fmt(session.total_expenses)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-900">
              <span>Efectivo esperado</span>
              <span>${fmt(expected)}</span>
            </div>
          </div>

          {/* Counted amount */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Efectivo contado <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                autoFocus
              />
            </div>
          </div>

          {/* Live difference preview */}
          {diff !== null && (
            <div className={`rounded-lg p-3 text-sm font-medium flex items-center justify-between ${
              diff === 0 ? 'bg-green-50 text-green-700' :
              diff > 0  ? 'bg-brand-50 text-brand-700' :
                          'bg-red-50 text-red-700'
            }`}>
              <span>Diferencia</span>
              <DifferenceChip value={String(diff)} />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones del turno…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Cerrando…' : 'Confirmar Cierre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Active Session Panel ──────────────────────────────────────────────────────

function ActiveSession({
  session,
  onClosed,
}: {
  session: CashSession;
  onClosed: (closed: CashSession) => void;
}) {
  const qc = useQueryClient();
  const [showClose, setShowClose] = useState(false);
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [addingExp, setAddingExp] = useState(false);

  const closeMutation = useMutation({
    mutationFn: ({ amount, notes }: { amount: string; notes: string }) =>
      api.post<CashSession>(`/cash/${session.id}/close`, { closing_amount: amount, notes: notes || null }),
    onSuccess: (res) => {
      toast.success('Turno cerrado correctamente');
      setShowClose(false);
      onClosed(res.data);
    },
    onError: () => toast.error('Error al cerrar el turno'),
  });

  const addExpMutation = useMutation({
    mutationFn: () =>
      api.post(`/cash/${session.id}/expenses`, { amount: expAmount, description: expDesc }),
    onSuccess: () => {
      toast.success('Egreso registrado');
      setExpAmount('');
      setExpDesc('');
      setAddingExp(false);
      qc.invalidateQueries({ queryKey: ['cash-current'] });
    },
    onError: () => toast.error('Error al registrar el egreso'),
  });

  const delExpMutation = useMutation({
    mutationFn: (expId: number) => api.delete(`/cash/${session.id}/expenses/${expId}`),
    onSuccess: () => {
      toast.success('Egreso eliminado');
      qc.invalidateQueries({ queryKey: ['cash-current'] });
    },
    onError: () => toast.error('Error al eliminar el egreso'),
  });

  const handleAddExp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expAmount || Number(expAmount) <= 0) { toast.error('Monto inválido'); return; }
    if (!expDesc.trim()) { toast.error('Ingresa una descripción'); return; }
    addExpMutation.mutate();
  };

  const expected = Number(session.opening_amount) + Number(session.cash_sales) - Number(session.total_expenses);

  return (
    <>
      {showClose && (
        <CloseModal
          session={session}
          onClose={(amount, notes) => closeMutation.mutateAsync({ amount, notes })}
          onCancel={() => setShowClose(false)}
        />
      )}

      <div className="space-y-5">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              Turno activo
            </span>
            <span>Abierto: {fmtDate(session.opened_at)}</span>
          </div>
          <button
            onClick={() => setShowClose(true)}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <Lock size={15} /> Cerrar Turno
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Apertura" value={`$${fmt(session.opening_amount)}`} color="gray" />
          <StatCard label="Ventas efectivo" value={`$${fmt(session.cash_sales)}`} color="green" />
          <StatCard label="Egresos" value={`$${fmt(session.total_expenses)}`} color="red" />
          <StatCard
            label="Efectivo esperado"
            value={`$${fmt(expected)}`}
            color="blue"
            sub="apertura + ventas − egresos"
          />
        </div>

        {/* Expenses section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingDown size={16} className="text-red-500" /> Egresos del turno
              {session.expenses.length > 0 && (
                <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {session.expenses.length}
                </span>
              )}
            </h3>
            <button
              onClick={() => setAddingExp(v => !v)}
              className="flex items-center gap-1.5 text-sm text-brand-900 hover:text-brand-700 font-medium px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
            >
              <Plus size={15} /> Agregar egreso
            </button>
          </div>

          {/* Add expense inline form */}
          {addingExp && (
            <form onSubmit={handleAddExp} className="p-4 border-b border-gray-100 bg-brand-50/40 flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs text-gray-500 block mb-1">Monto</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={expAmount}
                    onChange={e => setExpAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex-[3] min-w-[200px]">
                <label className="text-xs text-gray-500 block mb-1">Descripción</label>
                <input
                  type="text"
                  placeholder="Ej: Cambio de billetes, pago de servicio…"
                  value={expDesc}
                  onChange={e => setExpDesc(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setAddingExp(false); setExpAmount(''); setExpDesc(''); }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addExpMutation.isPending}
                  className="bg-brand-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand-800 disabled:opacity-50 transition-colors"
                >
                  {addExpMutation.isPending ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          )}

          {/* Expenses list */}
          {session.expenses.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">
              No hay egresos registrados en este turno
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {session.expenses.map(exp => (
                <div key={exp.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm text-gray-900">{exp.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtDate(exp.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-red-600">−${fmt(exp.amount)}</span>
                    <button
                      onClick={() => {
                        if (!confirm('¿Eliminar este egreso?')) return;
                        delExpMutation.mutate(exp.id);
                      }}
                      disabled={delExpMutation.isPending}
                      className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Closed Session Summary ────────────────────────────────────────────────────

function ClosedSummary({ session, onNewSession }: { session: CashSession; onNewSession: () => void }) {
  const diff = session.difference;
  const diffN = Number(diff ?? 0);

  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Calculator size={18} /> Resumen del turno
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {fmtDate(session.opened_at)} → {session.closed_at ? fmtDate(session.closed_at) : '—'}
          </p>
        </div>
        <div className="p-6 space-y-3 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Monto de apertura</span>
            <span className="font-medium">${fmt(session.opening_amount)}</span>
          </div>
          <div className="flex justify-between text-green-700">
            <span>+ Ventas en efectivo</span>
            <span className="font-medium">+${fmt(session.cash_sales)}</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>− Total egresos</span>
            <span className="font-medium">−${fmt(session.total_expenses)}</span>
          </div>
          <div className="border-t border-gray-200 pt-3 flex justify-between font-semibold text-gray-800">
            <span>Efectivo esperado</span>
            <span>${fmt(session.expected_amount)}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-800">
            <span>Efectivo contado</span>
            <span>${fmt(session.closing_amount)}</span>
          </div>
          <div className={`border-t pt-3 flex justify-between font-bold text-base ${
            diffN === 0 ? 'text-green-700' : diffN > 0 ? 'text-brand-700' : 'text-red-600'
          }`}>
            <span>Diferencia</span>
            <DifferenceChip value={diff} />
          </div>
          {session.notes && (
            <div className="pt-1 text-gray-500 bg-gray-50 rounded-lg p-3 text-xs">
              <span className="font-medium text-gray-600 block mb-0.5">Notas:</span>
              {session.notes}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onNewSession}
            className="w-full bg-brand-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-brand-800 transition-colors"
          >
            Abrir nuevo turno
          </button>
        </div>
      </div>
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab() {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const { data, isLoading } = useQuery<HistoryResponse>({
    queryKey: ['cash-history', page, size],
    queryFn: async () =>
      (await api.get(`/cash/history?page=${page}&size=${size}`)).data,
  });

  const STATUS = {
    open:   { label: 'Abierto',  cls: 'bg-green-100 text-green-700' },
    closed: { label: 'Cerrado',  cls: 'bg-gray-100 text-gray-600' },
  } as Record<string, { label: string; cls: string }>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {isLoading ? (
        <div className="p-12 flex justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-brand-900 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-cards w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cajero</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Apertura</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Esperado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Contado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Diferencia</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Apertura</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Cierre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.items.map(s => {
                const statusCfg = STATUS[s.status] ?? STATUS.closed;
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 font-medium">{s.user_full_name}</td>
                    <td data-label="Apertura" className="px-4 py-3 text-right text-gray-700">${fmt(s.opening_amount)}</td>
                    <td data-label="Esperado" className="px-4 py-3 text-right text-gray-700">{s.expected_amount ? `$${fmt(s.expected_amount)}` : '—'}</td>
                    <td data-label="Contado" className="px-4 py-3 text-right text-gray-700">{s.closing_amount ? `$${fmt(s.closing_amount)}` : '—'}</td>
                    <td data-label="Diferencia" className="px-4 py-3 text-right">
                      <DifferenceChip value={s.difference} />
                    </td>
                    <td data-label="Estado" className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.cls}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td data-label="Abierta" className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                      {fmtDate(s.opened_at)}
                    </td>
                    <td data-label="Cerrada" className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                      {s.closed_at ? fmtDate(s.closed_at) : '—'}
                    </td>
                  </tr>
                );
              })}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No hay sesiones de caja registradas
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
        onPage={setPage}
        onSizeChange={s => { setSize(s); setPage(1); }}
      />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function CashRegister() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();
  const [tab, setTab] = useState<'session' | 'history'>('session');
  const [lastClosed, setLastClosed] = useState<CashSession | null>(null);

  const { data: session, isLoading } = useQuery<CashSession | null>({
    queryKey: ['cash-current'],
    queryFn: async () => {
      const res = await api.get('/cash/current');
      return res.data;
    },
    refetchInterval: 30_000,
  });

  const openMutation = useMutation({
    mutationFn: (amount: string) => api.post('/cash', { opening_amount: amount }),
    onSuccess: () => {
      toast.success('Turno abierto correctamente');
      setLastClosed(null);
      qc.invalidateQueries({ queryKey: ['cash-current'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Error al abrir el turno';
      toast.error(msg);
    },
  });

  // When an active session gets closed, ActiveSession calls onClosed with the response
  const handleSessionClosed = (closedSession: CashSession) => {
    setLastClosed(closedSession);
    qc.invalidateQueries({ queryKey: ['cash-current'] });
    qc.invalidateQueries({ queryKey: ['cash-history'] });
  };

  return (
    <div className="p-4 sm:p-8">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign size={22} /> Apertura / Cierre de Caja
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestión del turno: monto inicial, egresos y cuadre al cerrar
          </p>
        </div>
      </div>

      {/* Tabs — history tab only for admin */}
      {isAdmin && (
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('session')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'session' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Wallet size={15} /> Mi Turno
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <HistoryIcon size={15} /> Historial
          </button>
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && isAdmin && <HistoryTab />}

      {/* Session tab */}
      {tab === 'session' && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin h-10 w-10 border-4 border-brand-900 border-t-transparent rounded-full" />
            </div>
          ) : session?.status === 'open' ? (
            <ActiveSession session={session} onClosed={handleSessionClosed} />
          ) : lastClosed ? (
            <ClosedSummary
              session={lastClosed}
              onNewSession={() => setLastClosed(null)}
            />
          ) : (
            <OpenSessionForm onOpen={amount => openMutation.mutateAsync(amount)} />
          )}
        </>
      )}
    </div>
  );
}
