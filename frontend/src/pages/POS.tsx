import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { lookupProducts } from '../api/products';
import { createSale } from '../api/sales';
import { searchCustomers, type CustomerListItem } from '../api/customers';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import type { CartItem, Product } from '../types';
import { Button } from '../components/ui/Button';
import { ShoppingCart, Search, Trash2, Plus, Minus, Camera, CameraOff, Printer, UserRound, X } from 'lucide-react';

// Dynamic import for camera scanner to avoid SSR issues
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';

function CustomerSearch({
  selected, onSelect,
}: {
  selected: CustomerListItem | null;
  onSelect: (c: CustomerListItem | null) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CustomerListItem[]>([]);
  const [open, setOpen] = useState(false);

  const handleSearch = async (val: string) => {
    setQ(val);
    if (val.length < 1) { setResults([]); setOpen(false); return; }
    const items = await searchCustomers(val);
    setResults(items);
    setOpen(true);
  };

  if (selected) {
    return (
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
          <UserRound size={11} /> Cliente asociado
        </p>
        <div className="flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 text-sm">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-brand-900 truncate">{selected.full_name}</p>
            {selected.document_id && (
              <p className="text-brand-600 text-xs">CC {selected.document_id}</p>
            )}
          </div>
          <button onClick={() => onSelect(null)} className="text-brand-400 hover:text-red-500 transition-colors flex-shrink-0" title="Quitar cliente">
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <p className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
        <UserRound size={11} /> Cliente (opcional)
      </p>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={q}
          onChange={e => handleSearch(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Cédula, nombre o teléfono…"
          className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {results.map(c => (
            <button
              key={c.id}
              className="w-full text-left px-3 py-2.5 hover:bg-brand-50 transition-colors border-b border-gray-50 last:border-0"
              onMouseDown={() => { onSelect(c); setQ(''); setOpen(false); }}
            >
              <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {c.document_id ? `CC ${c.document_id}` : ''}
                {c.document_id && c.phone ? ' · ' : ''}
                {c.phone ?? ''}
              </p>
            </button>
          ))}
        </div>
      )}
      {open && q.length > 0 && results.length === 0 && (
        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2.5 text-xs text-gray-400">
          No se encontraron clientes con ese dato
        </div>
      )}
    </div>
  );
}

function CartPanel({
  cart, onUpdateQty, onRemove, onCheckout, total, isLoading,
  paymentMethod, onPaymentMethod, selectedCustomer, onCustomer,
  partialAmount, onPartialAmount,
}: {
  cart: CartItem[];
  onUpdateQty: (productId: number, delta: number) => void;
  onRemove: (productId: number) => void;
  onCheckout: (method: string, paidAmount?: number) => void;
  total: number;
  isLoading: boolean;
  paymentMethod: string;
  onPaymentMethod: (m: string) => void;
  selectedCustomer: CustomerListItem | null;
  onCustomer: (c: CustomerListItem | null) => void;
  partialAmount: string;
  onPartialAmount: (v: string) => void;
}) {

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <ShoppingCart size={18} /> Carrito ({cart.reduce((acc, i) => acc + i.quantity, 0)} items)
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
            <p>Escanea o busca un producto</p>
          </div>
        ) : (
          cart.map(item => (
            <div key={item.product.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.product.name}</p>
                <p className="text-xs text-gray-500">${parseFloat(item.product.price).toFixed(2)} c/u</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  aria-label="Quitar una unidad"
                  className="p-2 rounded hover:bg-gray-200 text-gray-600 transition-[background-color,transform] duration-150 ease-out-strong active:scale-90"
                  onClick={() => onUpdateQty(item.product.id, -1)}
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                <button
                  aria-label="Agregar una unidad"
                  className="p-2 rounded hover:bg-gray-200 text-gray-600 transition-[background-color,transform] duration-150 ease-out-strong active:scale-90"
                  onClick={() => onUpdateQty(item.product.id, 1)}
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="text-sm font-semibold w-16 text-right">
                ${(parseFloat(item.product.price) * item.quantity).toFixed(2)}
              </div>
              <button
                aria-label="Eliminar del carrito"
                className="p-2 rounded hover:bg-red-50 text-red-400 transition-[background-color,transform] duration-150 ease-out-strong active:scale-90"
                onClick={() => onRemove(item.product.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-gray-100 space-y-3">
        <CustomerSearch selected={selectedCustomer} onSelect={onCustomer} />

        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>

        {/* Payment method */}
        <div className="grid grid-cols-2 gap-1.5">
          {(['cash', 'card', 'transfer', 'credit'] as const).map(m => (
            <button
              key={m}
              onClick={() => { onPaymentMethod(m); if (m === 'credit') onPartialAmount('0'); else onPartialAmount(''); }}
              className={`py-2 rounded-lg text-xs font-medium transition-[color,background-color,transform] duration-150 ease-out-strong active:scale-[0.97] ${
                paymentMethod === m ? 'bg-brand-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {{ cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', credit: '💳 A Crédito' }[m]}
            </button>
          ))}
        </div>

        {/* Partial payment toggle — only for non-credit methods */}
        {paymentMethod !== 'credit' && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={partialAmount !== ''}
              onChange={e => onPartialAmount(e.target.checked ? '' : '\x00')}
              className="rounded border-gray-300 text-brand-600"
            />
            Abono parcial
          </label>
        )}

        {/* Partial / credit amount input */}
        {(paymentMethod === 'credit' || partialAmount !== '') && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            {paymentMethod !== 'credit' && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Monto que paga ahora</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    max={total}
                    step="0.01"
                    placeholder="0.00"
                    value={partialAmount === '\x00' ? '' : partialAmount}
                    onChange={e => onPartialAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    autoFocus
                  />
                </div>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold text-amber-800">
              <span>Queda a crédito:</span>
              <span>${Math.max(0, total - (paymentMethod === 'credit' ? 0 : parseFloat(partialAmount === '\x00' || partialAmount === '' ? '0' : partialAmount) || 0)).toFixed(2)}</span>
            </div>
            {!selectedCustomer && (
              <p className="text-xs text-red-600 font-medium">⚠ Debes seleccionar un cliente para ventas a crédito</p>
            )}
          </div>
        )}

        <Button
          size="lg"
          className="w-full"
          disabled={
            cart.length === 0 ||
            ((paymentMethod === 'credit' || partialAmount !== '') && !selectedCustomer)
          }
          loading={isLoading}
          onClick={() => {
            const paid = paymentMethod === 'credit' ? 0
              : partialAmount !== '' && partialAmount !== '\x00' ? parseFloat(partialAmount) || 0
              : undefined;
            onCheckout(paymentMethod, paid);
          }}
        >
          Finalizar Venta — ${total.toFixed(2)}
        </Button>
      </div>
    </div>
  );
}

export function POS() {
  const qc = useQueryClient();
  const [mobileTab, setMobileTab] = useState<'search' | 'cart'>('search');

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('pos_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [paymentMethod, setPaymentMethod] = useState<string>(
    () => localStorage.getItem('pos_payment_method') ?? 'cash'
  );

  useEffect(() => {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('pos_payment_method', paymentMethod);
  }, [paymentMethod]);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListItem | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [completedSale, setCompletedSale] = useState<{ sale_number: string; total: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const total = cart.reduce((acc, item) => acc + parseFloat(item.product.price) * item.quantity, 0);

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        const next = existing.quantity + 1;
        if (next > product.quantity) {
          toast.error(`SKU: ${product.sku} — stock insuficiente (disponible: ${product.quantity}, en carrito: ${existing.quantity})`);
          return prev;
        }
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: next } : i);
      }
      if (product.quantity === 0) {
        toast.error(`SKU: ${product.sku} — sin stock disponible`);
        return prev;
      }
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
    setResults([]);
    setSearchQuery('');
    setMobileTab('cart');
    searchRef.current?.focus();
  }, []);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const items = await lookupProducts(q);
      setResults(items);
      if (items.length === 1) {
        addToCart(items[0]);
      }
    } finally {
      setSearching(false);
    }
  };

  useBarcodeScanner(useCallback((barcode: string) => {
    handleSearch(barcode);
  }, [addToCart]), !cameraActive);

  // Camera scanner
  useEffect(() => {
    if (!cameraActive) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      return;
    }
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    if (videoRef.current) {
      reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (result) {
          handleSearch(result.getText());
        }
      }).then(controls => {
        controlsRef.current = controls;
      });
    }
    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [cameraActive]);

  const saleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (sale) => {
      setCompletedSale({ sale_number: sale.sale_number, total: sale.total });
      setCart([]);
      setSelectedCustomer(null);
      setPartialAmount('');
      localStorage.removeItem('pos_cart');
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      if (selectedCustomer) qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? 'Error al procesar la venta');
    },
  });

  const handleCheckout = (method: string, paidAmount?: number) => {
    const overStock = cart.filter(i => i.quantity > i.product.quantity);
    if (overStock.length > 0) {
      overStock.forEach(i => toast.error(
        `SKU: ${i.product.sku} — stock insuficiente (disponible: ${i.product.quantity}, solicitado: ${i.quantity})`,
        { duration: 5000 }
      ));
      return;
    }
    saleMutation.mutate({
      items: cart.map(i => ({ product_id: i.product.id, quantity: i.quantity, discount: i.discount })),
      payment_method: method === 'credit' ? 'cash' : method,
      customer_id: selectedCustomer?.id ?? undefined,
      paid_amount: paidAmount !== undefined ? paidAmount : undefined,
    });
  };

  if (completedSale) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-white rounded-2xl p-10 text-center shadow-xl max-w-sm w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="text-green-600" size={28} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">¡Venta completada!</h2>
          <p className="text-gray-500 text-sm mb-2">{completedSale.sale_number}</p>
          <p className="text-3xl font-bold text-brand-900 mb-6">${parseFloat(completedSale.total).toFixed(2)}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir
            </Button>
            <Button onClick={() => setCompletedSale(null)}>Nueva Venta</Button>
          </div>
        </div>
      </div>
    );
  }

  const cartCount = cart.reduce((acc, i) => acc + i.quantity, 0);

  const searchPanel = (
    <div className="flex flex-col h-full p-4 sm:p-6 overflow-hidden">
      <h2 className="text-xl font-bold text-gray-900 mb-4 hidden sm:block">Punto de Venta</h2>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={searchRef}
          autoFocus
          className="w-full border border-gray-300 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white shadow-sm"
          placeholder="Buscar por nombre, SKU o escanear código..."
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
        />
        <button
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded ${cameraActive ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}
          onClick={() => setCameraActive(v => !v)}
          title="Escáner de cámara"
        >
          {cameraActive ? <CameraOff size={18} /> : <Camera size={18} />}
        </button>
      </div>

      {cameraActive && (
        <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 bg-black" style={{ height: 220 }}>
          <video ref={videoRef} className="w-full h-full object-cover" />
        </div>
      )}

      {results.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4 overflow-y-auto">
          {results.map(p => (
            <button
              key={p.id}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-left"
              onClick={() => addToCart(p)}
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-400">{p.sku}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-brand-900">${parseFloat(p.price).toFixed(2)}</p>
                <p className={`text-xs ${p.quantity <= p.low_stock_threshold ? 'text-red-500' : 'text-gray-400'}`}>
                  Stock: {p.quantity}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {searching && (
        <div className="flex justify-center py-4">
          <div className="animate-spin h-6 w-6 border-4 border-brand-900 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );

  const cartPanel = (
    <CartPanel
      cart={cart}
      total={total}
      isLoading={saleMutation.isPending}
      paymentMethod={paymentMethod}
      onPaymentMethod={setPaymentMethod}
      onUpdateQty={(id, delta) => {
        setCart(prev => {
          if (delta > 0) {
            const item = prev.find(i => i.product.id === id);
            if (item && item.quantity + delta > item.product.quantity) {
              toast.error(
                `SKU: ${item.product.sku} — stock insuficiente (disponible: ${item.product.quantity})`
              );
              return prev;
            }
          }
          return prev
            .map(i => i.product.id === id ? { ...i, quantity: i.quantity + delta } : i)
            .filter(i => i.quantity > 0);
        });
      }}
      onRemove={id => setCart(prev => prev.filter(i => i.product.id !== id))}
      onCheckout={handleCheckout}
      selectedCustomer={selectedCustomer}
      onCustomer={setSelectedCustomer}
      partialAmount={partialAmount}
      onPartialAmount={setPartialAmount}
    />
  );

  return (
    <div className="flex flex-col h-full">

      {/* Mobile tab switcher */}
      <div className="sm:hidden flex border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={() => setMobileTab('search')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
            mobileTab === 'search'
              ? 'border-brand-900 text-brand-900'
              : 'border-transparent text-gray-500'
          }`}
        >
          <Search size={16} /> Buscar
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
            mobileTab === 'cart'
              ? 'border-brand-900 text-brand-900'
              : 'border-transparent text-gray-500'
          }`}
        >
          <ShoppingCart size={16} />
          Carrito
          {cartCount > 0 && (
            <span className="bg-brand-900 text-white text-xs px-1.5 py-0.5 rounded-full">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile: one panel at a time */}
      <div className="sm:hidden flex-1 overflow-hidden">
        {mobileTab === 'search' ? searchPanel : cartPanel}
      </div>

      {/* Desktop: side by side */}
      <div className="hidden sm:flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {searchPanel}
        </div>
        <div className="w-80 lg:w-96 flex-shrink-0">
          {cartPanel}
        </div>
      </div>
    </div>
  );
}
