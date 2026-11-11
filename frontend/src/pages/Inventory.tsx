import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getProducts, deleteProduct, previewCSV, confirmCSV,
  getCategories, createCategory, updateCategory, deleteCategory,
} from '../api/products';
import type { Product, Category } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Plus, Upload, Pencil, Trash2, AlertTriangle, Search, Tag, X, Check, Download, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Pagination } from '../components/ui/Pagination';
import { ProductForm } from './ProductForm';
import { clsx } from 'clsx';

// ── Tab navigation ─────────────────────────────────────────────────────────────

function InventoryTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const isProducts = !location.pathname.includes('/categorias');

  return (
    <div className="flex border-b border-gray-200 mb-0">
      <button
        onClick={() => navigate('/inventario')}
        className={clsx(
          'px-5 py-3 text-sm font-medium border-b-2 transition-colors',
          isProducts
            ? 'border-brand-900 text-brand-900'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        )}
      >
        Productos
      </button>
      <button
        onClick={() => navigate('/inventario/categorias')}
        className={clsx(
          'px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5',
          !isProducts
            ? 'border-brand-900 text-brand-900'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        )}
      >
        <Tag size={14} /> Categorías
      </button>
    </div>
  );
}

// ── Products list ─────────────────────────────────────────────────────────────

function ProductList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, page, size, lowStockOnly, sortBy, sortDir],
    queryFn: () => getProducts({ q: search || undefined, low_stock_only: lowStockOnly, page, size, sort_by: sortBy, sort_dir: sortDir }),
  });

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir(field === 'quantity' ? 'asc' : 'asc');
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
    mutationFn: deleteProduct,
    onSuccess: () => {
      toast.success('Producto desactivado');
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Inventario</h2>
          <p className="text-gray-500 text-sm">{data?.total ?? 0} productos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/inventario/importar')}>
            <Upload size={16} /> <span className="hidden sm:inline">Importar CSV</span>
          </Button>
          <Button size="sm" onClick={() => navigate('/inventario/nuevo')}>
            <Plus size={16} /> <span className="hidden sm:inline">Nuevo Producto</span>
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <InventoryTabs />

        <div className="p-3 sm:p-4 border-b border-gray-100 flex gap-3 items-center flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Buscar por nombre, SKU o código de barras..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex gap-1 items-center">
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="name">Nombre</option>
              <option value="sku">SKU</option>
              <option value="price">Precio</option>
              <option value="quantity">Stock</option>
              <option value="created_at">Fecha</option>
            </select>
            <button
              onClick={() => { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); setPage(1); }}
              className="border border-gray-300 rounded-lg px-2.5 py-2 text-sm hover:bg-gray-50 transition-colors"
              title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
            >
              {sortDir === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={lowStockOnly} onChange={e => { setLowStockOnly(e.target.checked); setPage(1); }} />
            Solo stock bajo
          </label>
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-brand-900 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="table-cards w-full text-sm min-w-[540px]">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-gray-900 transition-colors">
                    Producto <SortIcon field="name" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  <button onClick={() => toggleSort('sku')} className="flex items-center gap-1 hover:text-gray-900 transition-colors">
                    SKU <SortIcon field="sku" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Categoría</th>
                <th className="text-right px-4 py-3 font-medium">
                  <button onClick={() => toggleSort('price')} className="flex items-center gap-1 ml-auto hover:text-gray-900 transition-colors">
                    Precio <SortIcon field="price" />
                  </button>
                </th>
                <th className="text-center px-4 py-3 font-medium">
                  <button onClick={() => toggleSort('quantity')} className="flex items-center gap-1 mx-auto hover:text-gray-900 transition-colors">
                    Stock <SortIcon field="quantity" />
                  </button>
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.items.map((p: Product) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.name}</div>
                    {p.barcode && <div className="text-xs text-gray-400">{p.barcode}</div>}
                  </td>
                  <td data-label="SKU" className="px-4 py-3 text-gray-600 font-mono text-xs">{p.sku}</td>
                  <td data-label="Categoría" className="px-4 py-3 text-gray-600 hidden md:table-cell">{p.category?.name ?? '—'}</td>
                  <td data-label="Precio" className="px-4 py-3 text-right font-medium">${parseFloat(p.price).toFixed(2)}</td>
                  <td data-label="Stock" className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.is_low_stock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {p.is_low_stock && <AlertTriangle size={11} />}
                      {p.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        className="p-1.5 rounded hover:bg-brand-50 text-brand-600"
                        onClick={() => navigate(`/inventario/${p.id}/editar`)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-red-50 text-red-500"
                        onClick={() => {
                          if (confirm(`¿Desactivar "${p.name}"?`)) deleteMutation.mutate(p.id);
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No se encontraron productos</td></tr>
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
    </div>
  );
}

// ── Categories manager ────────────────────────────────────────────────────────

function CategoryRow({
  cat, onSaved, onDeleted,
}: {
  cat: Category;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  const [description, setDescription] = useState(cat.description ?? '');

  const updateMutation = useMutation({
    mutationFn: () => updateCategory(cat.id, { name, description: description || undefined }),
    onSuccess: () => { toast.success('Categoría actualizada'); setEditing(false); onSaved(); },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCategory(cat.id),
    onSuccess: () => { toast.success('Categoría eliminada'); onDeleted(); },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? 'Error al eliminar');
    },
  });

  if (editing) {
    return (
      <tr className="bg-brand-50">
        <td className="px-4 py-2">
          <input
            className="w-full border border-brand-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </td>
        <td className="px-4 py-2">
          <input
            className="w-full border border-brand-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descripción opcional"
          />
        </td>
        <td className="px-4 py-2">
          <div className="flex justify-end gap-1">
            <button
              className="p-1.5 rounded hover:bg-green-100 text-green-600"
              onClick={() => updateMutation.mutate()}
              disabled={!name.trim() || updateMutation.isPending}
            >
              <Check size={15} />
            </button>
            <button
              className="p-1.5 rounded hover:bg-gray-200 text-gray-500"
              onClick={() => { setEditing(false); setName(cat.name); setDescription(cat.description ?? ''); }}
            >
              <X size={15} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 font-medium text-gray-900">{cat.name}</td>
      <td className="px-4 py-3 text-gray-500 text-sm">{cat.description ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <button
            className="p-1.5 rounded hover:bg-brand-50 text-brand-600"
            onClick={() => setEditing(true)}
          >
            <Pencil size={15} />
          </button>
          <button
            className="p-1.5 rounded hover:bg-red-50 text-red-500"
            onClick={() => {
              if (confirm(`¿Eliminar la categoría "${cat.name}"?`)) deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function CategoriesManager() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const createMutation = useMutation({
    mutationFn: () => createCategory({ name: newName.trim(), description: newDesc.trim() || undefined }),
    onSuccess: () => {
      toast.success('Categoría creada');
      qc.invalidateQueries({ queryKey: ['categories'] });
      setNewName('');
      setNewDesc('');
      setShowForm(false);
    },
    onError: () => toast.error('Error al crear la categoría'),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['categories'] });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventario</h2>
          <p className="text-gray-500 text-sm">{categories.length} categorías</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? <><X size={16} /> Cancelar</> : <><Plus size={16} /> Nueva Categoría</>}
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4 flex gap-3 items-end">
          <div className="flex-1">
            <Input
              label="Nombre *"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ej: Medicamentos"
              autoFocus
            />
          </div>
          <div className="flex-1">
            <Input
              label="Descripción"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Descripción opcional"
            />
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!newName.trim()}
            loading={createMutation.isPending}
          >
            Crear
          </Button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <InventoryTabs />

        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-brand-900 border-t-transparent rounded-full" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Descripción</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map(cat => (
                <CategoryRow key={cat.id} cat={cat} onSaved={invalidate} onDeleted={invalidate} />
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-gray-400">
                    No hay categorías. Crea la primera arriba.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── CSV Import ────────────────────────────────────────────────────────────────

const CSV_SAMPLE = `name,sku,barcode,description,price,cost,quantity,low_stock_threshold,category_id
Acetaminofén 500mg,ACET-500,7702001001234,Analgésico y antipirético,4500,2800,50,10,
Ibuprofeno 400mg,IBU-400,7702001005678,Antiinflamatorio no esteroideo,6200,3900,30,8,
Loratadina 10mg,LOR-10,7702001009012,Antihistamínico para alergias,3800,2200,25,5,
Vitamina C 1000mg x30,VITC-1000,7702001003456,Suplemento vitamínico efervescente,12500,7800,40,10,
Helado Vainilla 500ml,HEL-VAI-500,7791234500012,Helado artesanal de vainilla,8900,5200,20,5,
`;

function downloadSampleCSV() {
  const blob = new Blob([CSV_SAMPLE], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_productos.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function CSVImport() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ valid_rows: unknown[]; error_rows: unknown[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const result = await previewCSV(file);
      setPreview(result);
    } catch {
      toast.error('Error al leer el archivo CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const result = await confirmCSV(file);
      toast.success(`${result.created} productos importados`);
      navigate('/inventario');
    } catch {
      toast.error('Error al importar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/inventario" className="text-gray-400 hover:text-gray-600 text-sm">← Volver</Link>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Importar CSV</h2>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div className="bg-brand-50 rounded-lg p-4 text-sm text-brand-800 flex items-start justify-between gap-4">
          <div>
            <p className="font-medium mb-1">Columnas requeridas: <code className="bg-brand-100 px-1 rounded">name</code>, <code className="bg-brand-100 px-1 rounded">sku</code>, <code className="bg-brand-100 px-1 rounded">price</code></p>
            <p className="text-brand-600">Opcionales: barcode, description, cost, quantity, low_stock_threshold, category_id</p>
          </div>
          <button
            onClick={downloadSampleCSV}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-100 hover:bg-brand-200 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors"
          >
            <Download size={13} /> Descargar plantilla
          </button>
        </div>

        <input
          type="file"
          accept=".csv"
          onChange={e => { setFile(e.target.files?.[0] ?? null); setPreview(null); }}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
        />

        <div className="flex gap-2">
          <Button onClick={handlePreview} disabled={!file} loading={loading} variant="secondary">
            Vista previa
          </Button>
          {preview && preview.valid_rows.length > 0 && (
            <Button onClick={handleConfirm} loading={loading}>
              Confirmar importación ({preview.valid_rows.length} válidos)
            </Button>
          )}
        </div>

        {preview && (
          <div>
            <p className="text-sm text-gray-600 mb-2">
              {preview.valid_rows.length} filas válidas · {preview.error_rows.length} con errores
            </p>
            {(preview.error_rows as Array<{ row: number; errors: string[] }>).slice(0, 5).map((e, i) => (
              <div key={i} className="text-sm text-red-600 bg-red-50 rounded p-2 mb-1">
                Fila {e.row}: {e.errors?.join(', ')}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────

export function Inventory() {
  return (
    <Routes>
      <Route index element={<ProductList />} />
      <Route path="categorias" element={<CategoriesManager />} />
      <Route path="nuevo" element={<ProductForm />} />
      <Route path=":id/editar" element={<ProductForm />} />
      <Route path="importar" element={<CSVImport />} />
    </Routes>
  );
}
