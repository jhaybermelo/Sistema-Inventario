import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Plus, X, Search, Trash2, Eye, Ban, ShoppingBag,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { getPurchases, createPurchase, cancelPurchase } from '../api/purchases';
import { getProducts } from '../api/products';
import { useAuth } from '../context/AuthContext';
import type { Purchase, Product } from '../types';

interface DraftItem {
  product: Product;
  quantity: number;
  unit_cost: number;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        Cancelada
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      Confirmada
    </span>
  );
}

function ProductSearchInput({ onAdd }: { onAdd: (product: Product) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results } = useQuery({
    queryKey: ['products-search-purchase', query],
    queryFn: () => getProducts({ q: query, size: 10 }),
    enabled: query.length >= 1,
    staleTime: 5000,
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar por nombre, SKU o código de barras..."
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      {open && (results?.items.length ?? 0) > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {results!.items.map(p => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors text-sm border-b border-gray-50 last:border-0"
              onClick={() => { onAdd(p); setQuery(''); setOpen(false); }}
            >
              <span className="font-medium text-gray-900">{p.name}</span>
              <span className="text-gray-400 mx-1.5 text-xs">·</span>
              <span className="text-xs text-gray-500">SKU: {p.sku}</span>
              <span className="text-gray-400 mx-1.5 text-xs">·</span>
              <span className="text-xs text-gray-500">Stock actual: {p.quantity}</span>
              {p.cost && (
                <>
                  <span className="text-gray-400 mx-1.5 text-xs">·</span>
                  <span className="text-xs text-gray-400">
                    Costo: ${parseFloat(p.cost).toLocaleString('es')}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewPurchaseDrawer({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [updateCosts, setUpdateCosts] = useState(true);
  const [items, setItems] = useState<DraftItem[]>([]);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: () => {
      toast.success('Compra registrada — stock actualizado');
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['low-stock-count'] });
      onSuccess();
    },
    onError: () => toast.error('Error al registrar la compra'),
  });

  const addProduct = (product: Product) => {
    setItems(prev => {
      const existing = prev.findIndex(i => i.product.id === product.id);
      if (existing >= 0) {
        return prev.map((item, idx) =>
          idx === existing ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, {
        product,
        quantity: 1,
        unit_cost: product.cost ? parseFloat(product.cost) : 0,
      }];
    });
  };

  const updateItem = (index: number, field: 'quantity' | 'unit_cost', value: number) => {
    setItems(prev => prev.map((item, idx) =>
      idx === index ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }
    mutation.mutate({
      supplier_name: supplierName.trim() || undefined,
      notes: notes.trim() || undefined,
      update_costs: updateCosts,
      items: items.map(i => ({
        product_id: i.product.id,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
      })),
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-xl bg-white h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-900">Nueva Compra</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Proveedor</label>
              <input
                type="text"
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                placeholder="Ej: Depósito El Constructor (opcional)"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Agregar productos
              </label>
              <ProductSearchInput onAdd={addProduct} />
            </div>

            {items.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-12 text-xs text-gray-400 px-1 gap-2">
                  <span className="col-span-4">Producto</span>
                  <span className="col-span-2 text-center">Cant.</span>
                  <span className="col-span-3 text-center">Costo unit.</span>
                  <span className="col-span-2 text-right">Subtotal</span>
                  <span className="col-span-1" />
                </div>

                {items.map((item, idx) => (
                  <div
                    key={`${item.product.id}-${idx}`}
                    className="grid grid-cols-12 items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5"
                  >
                    <div className="col-span-4 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.product.name}</p>
                      <p className="text-xs text-gray-400">{item.product.sku}</p>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unit_cost}
                        onChange={e => updateItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div className="col-span-2 text-right text-sm font-semibold text-gray-900">
                      ${(item.quantity * item.unit_cost).toLocaleString('es', { minimumFractionDigits: 0 })}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-600">
                    {items.length} producto{items.length !== 1 ? 's' : ''} —{' '}
                    {items.reduce((s, i) => s + i.quantity, 0)} unidades
                  </span>
                  <span className="text-xl font-bold text-gray-900">
                    ${total.toLocaleString('es', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            )}

            {items.length === 0 && (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400">
                <ShoppingBag size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Busca y agrega los productos comprados</p>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Notas</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Observaciones sobre la compra (opcional)"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>

            <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={updateCosts}
                onChange={e => setUpdateCosts(e.target.checked)}
                className="rounded border-gray-300 text-brand-600"
              />
              Actualizar precio de costo de los productos
            </label>
          </div>

          <div className="p-5 border-t border-gray-100 flex-shrink-0">
            <button
              type="submit"
              disabled={mutation.isPending || items.length === 0}
              className="w-full bg-brand-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-brand-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Registrando...' : `Registrar Compra${total > 0 ? ` · $${total.toLocaleString('es', { minimumFractionDigits: 0 })}` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PurchaseDetailModal({
  purchase,
  onClose,
  onCancel,
  isAdmin,
}: {
  purchase: Purchase;
  onClose: () => void;
  onCancel: (id: number) => void;
  isAdmin: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900 font-mono">{purchase.purchase_number}</h3>
            <p className="text-sm text-gray-500">
              {new Date(purchase.created_at).toLocaleString('es', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={purchase.status} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {purchase.supplier_name && (
            <div className="flex justify-between text-sm bg-gray-50 rounded-lg px-4 py-2.5">
              <span className="text-gray-500">Proveedor</span>
              <span className="font-medium text-gray-900">{purchase.supplier_name}</span>
            </div>
          )}
          {purchase.notes && (
            <p className="text-sm text-gray-500 bg-yellow-50 border border-yellow-100 p-3 rounded-lg">
              {purchase.notes}
            </p>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Producto</th>
                <th className="pb-2 text-center font-medium">Cant.</th>
                <th className="pb-2 text-right font-medium">C. Unit.</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map(item => (
                <tr key={item.id} className="border-b border-gray-50">
                  <td className="py-2.5">
                    <p className="font-medium text-gray-900">{item.product_name}</p>
                    <p className="text-xs text-gray-400">{item.product_sku}</p>
                  </td>
                  <td className="py-2.5 text-center text-gray-700">{item.quantity}</td>
                  <td className="py-2.5 text-right text-gray-700">
                    ${parseFloat(item.unit_cost).toLocaleString('es', { minimumFractionDigits: 0 })}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-gray-900">
                    ${parseFloat(item.line_total).toLocaleString('es', { minimumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="font-bold text-gray-900">Total Compra</span>
            <span className="text-2xl font-bold text-gray-900">
              ${parseFloat(purchase.total).toLocaleString('es', { minimumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {isAdmin && purchase.status === 'confirmed' && (
          <div className="p-5 border-t border-gray-100">
            <button
              onClick={() => { onCancel(purchase.id); onClose(); }}
              className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <Ban size={15} />
              Cancelar compra y revertir stock
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Purchases() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [supplierQ, setSupplierQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', page, size, dateFrom, dateTo, supplierQ],
    queryFn: () => getPurchases({
      page,
      size,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      supplier_name: supplierQ || undefined,
    }),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelPurchase,
    onSuccess: () => {
      toast.success('Compra cancelada — stock revertido');
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('Error al cancelar la compra'),
  });

  const clearFilters = () => {
    setSupplierQ('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasFilters = supplierQ || dateFrom || dateTo;

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Compras</h2>
          <p className="text-gray-500 text-sm">Ingreso de mercancía y actualización de stock</p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 bg-brand-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-800 transition-colors"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Nueva Compra</span>
          <span className="sm:hidden">Nueva</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={supplierQ}
            onChange={e => { setSupplierQ(e.target.value); setPage(1); }}
            placeholder="Buscar proveedor..."
            className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <input
          type="date"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
          >
            <X size={14} /> Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-brand-900 border-t-transparent rounded-full" />
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <ShoppingBag size={48} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No hay compras registradas</p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-2 text-sm text-brand-600 hover:underline">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-cards w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">N°</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Productos</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data!.items.map(purchase => (
                  <tr
                    key={purchase.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedPurchase(purchase)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-brand-700 font-semibold">
                      {purchase.purchase_number}
                    </td>
                    <td data-label="Fecha" className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(purchase.created_at).toLocaleDateString('es', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                      })}
                    </td>
                    <td data-label="Proveedor" className="px-4 py-3 text-gray-900">
                      {purchase.supplier_name ?? (
                        <span className="text-gray-400 text-xs italic">Sin proveedor</span>
                      )}
                    </td>
                    <td data-label="Productos" className="px-4 py-3 text-center text-gray-600">
                      {purchase.items.length}
                      <span className="text-gray-400 text-xs ml-1">
                        ({purchase.items.reduce((s, i) => s + i.quantity, 0)} uds)
                      </span>
                    </td>
                    <td data-label="Total" className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                      ${parseFloat(purchase.total).toLocaleString('es', { minimumFractionDigits: 0 })}
                    </td>
                    <td data-label="Estado" className="px-4 py-3 text-center">
                      <StatusBadge status={purchase.status} />
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedPurchase(purchase)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                        title="Ver detalle"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {(data?.total ?? 0) > 0 && (
          <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{data?.total} registros</span>
              <select
                value={size}
                onChange={e => { setSize(Number(e.target.value)); setPage(1); }}
                className="border border-gray-200 rounded px-2 py-1 text-xs"
              >
                {[10, 15, 20, 50].map(s => (
                  <option key={s} value={s}>{s} por página</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-600 px-2">{page} / {data?.pages ?? 1}</span>
              <button
                onClick={() => setPage(p => Math.min(data?.pages ?? 1, p + 1))}
                disabled={page === (data?.pages ?? 1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {drawerOpen && (
        <NewPurchaseDrawer
          onClose={() => setDrawerOpen(false)}
          onSuccess={() => setDrawerOpen(false)}
        />
      )}

      {selectedPurchase && (
        <PurchaseDetailModal
          purchase={selectedPurchase}
          onClose={() => setSelectedPurchase(null)}
          onCancel={id => cancelMutation.mutate(id)}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
