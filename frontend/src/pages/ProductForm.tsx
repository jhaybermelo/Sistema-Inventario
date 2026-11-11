import { useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getProduct, createProduct, updateProduct, getCategories } from '../api/products';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  sku: z.string().min(1, 'Requerido'),
  barcode: z.string().optional(),
  description: z.string().optional(),
  price: z.string().min(1, 'Requerido'),
  cost: z.string().optional(),
  quantity: z.number().int().min(0),
  low_stock_threshold: z.number().int().min(0),
  category_id: z.number().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

export function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: product } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(Number(id)),
    enabled: isEdit,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 0, low_stock_threshold: 5 },
  });

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode ?? '',
        description: product.description ?? '',
        price: product.price,
        cost: product.cost ?? '',
        quantity: product.quantity,
        low_stock_threshold: product.low_stock_threshold,
        category_id: product.category_id,
      });
    }
  }, [product, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      isEdit ? updateProduct(Number(id), data) : createProduct(data),
    onSuccess: () => {
      toast.success(isEdit ? 'Producto actualizado' : 'Producto creado');
      qc.invalidateQueries({ queryKey: ['products'] });
      navigate('/inventario');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? 'Error al guardar');
    },
  });

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/inventario" className="text-gray-400 hover:text-gray-600 text-sm">← Volver</Link>
        <h2 className="text-2xl font-bold text-gray-900">{isEdit ? 'Editar Producto' : 'Nuevo Producto'}</h2>
      </div>

      <form onSubmit={handleSubmit(d => mutation.mutate(d as FormData))} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre *" {...register('name')} error={errors.name?.message} />
          <Input label="SKU *" {...register('sku')} error={errors.sku?.message} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Código de barras" {...register('barcode')} placeholder="EAN-13, UPC..." />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Categoría</label>
            <select
              {...register('category_id', { valueAsNumber: true })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Sin categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <Input label="Descripción" {...register('description')} />
        <div className={`grid gap-4 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <Input label="Precio de venta *" type="number" step="0.01" {...register('price')} error={errors.price?.message} />
          {isAdmin && <Input label="Costo" type="number" step="0.01" {...register('cost')} />}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Cantidad en stock" type="number" {...register('quantity', { valueAsNumber: true })} />
          <Input label="Umbral de stock bajo" type="number" {...register('low_stock_threshold', { valueAsNumber: true })} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={mutation.isPending}>
            {isEdit ? 'Guardar cambios' : 'Crear producto'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/inventario')}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
