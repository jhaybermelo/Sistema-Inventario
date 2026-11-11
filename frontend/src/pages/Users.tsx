import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../api/client';
import type { User } from '../types';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { useAuth } from '../context/AuthContext';
import { Plus, X, Search, Pencil, Trash2 } from 'lucide-react';

// ── Schemas ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  username: z.string().min(1, 'Requerido'),
  email: z.string().email('Email inválido'),
  full_name: z.string().min(1, 'Requerido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  role: z.enum(['admin', 'cashier']),
});

const editSchema = z.object({
  full_name: z.string().min(1, 'Requerido'),
  email: z.string().email('Email inválido'),
  role: z.enum(['admin', 'cashier']),
  is_active: z.boolean(),
  password: z.string().min(6, 'Mínimo 6 caracteres').or(z.literal('')).optional(),
});

type CreateData = z.infer<typeof createSchema>;
type EditData = z.infer<typeof editSchema>;

// ── Component ─────────────────────────────────────────────────────────────────

export function Users() {
  const qc = useQueryClient();
  const { user: me } = useAuth();

  const [mode, setMode] = useState<'none' | 'create' | 'edit'>('none');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u => {
      const matchesSearch = !q
        || u.full_name.toLowerCase().includes(q)
        || u.username.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q);
      const matchesRole = !roleFilter || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages);
  const pageItems = filtered.slice((safePage - 1) * size, safePage * size);

  const resetPage = () => setPage(1);

  // ── Create ─────────────────────────────────────────────────────────────────

  const createForm = useForm<CreateData>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'cashier' },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateData) => api.post('/users', data),
    onSuccess: () => {
      toast.success('Usuario creado');
      qc.invalidateQueries({ queryKey: ['users'] });
      setMode('none');
      createForm.reset();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? 'Error al crear usuario');
    },
  });

  // ── Edit ───────────────────────────────────────────────────────────────────

  const editForm = useForm<EditData>({
    resolver: zodResolver(editSchema),
  });

  useEffect(() => {
    if (editingUser) {
      editForm.reset({
        full_name: editingUser.full_name,
        email: editingUser.email,
        role: editingUser.role as 'admin' | 'cashier',
        is_active: editingUser.is_active,
        password: '',
      });
    }
  }, [editingUser, editForm]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EditData }) => {
      const payload: Record<string, unknown> = {
        full_name: data.full_name,
        email: data.email,
        role: data.role,
        is_active: data.is_active,
      };
      if (data.password) payload.password = data.password;
      return api.put(`/users/${id}`, payload);
    },
    onSuccess: () => {
      toast.success('Usuario actualizado');
      qc.invalidateQueries({ queryKey: ['users'] });
      setMode('none');
      setEditingUser(null);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? 'Error al actualizar usuario');
    },
  });

  // ── Delete ─────────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success('Usuario desactivado');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? 'Error al eliminar usuario');
    },
  });

  const handleEdit = (u: User) => {
    setEditingUser(u);
    setMode('edit');
    createForm.reset();
  };

  const handleDelete = (u: User) => {
    if (!confirm(`¿Desactivar al usuario "${u.full_name}"? No podrá iniciar sesión.`)) return;
    deleteMutation.mutate(u.id);
  };

  const closeForm = () => {
    setMode('none');
    setEditingUser(null);
    createForm.reset();
    editForm.reset();
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Usuarios</h2>
          <p className="text-sm text-gray-500">{users.length} usuarios registrados</p>
        </div>
        <Button size="sm" onClick={() => mode === 'create' ? closeForm() : (closeForm(), setMode('create'))}>
          {mode === 'create' ? <><X size={16} /> Cancelar</> : <><Plus size={16} /> Nuevo Usuario</>}
        </Button>
      </div>

      {/* Create form */}
      {mode === 'create' && (
        <form
          onSubmit={createForm.handleSubmit(d => createMutation.mutate(d))}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6 space-y-4"
        >
          <h3 className="font-semibold text-gray-900">Nuevo Usuario</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Usuario" {...createForm.register('username')} error={createForm.formState.errors.username?.message} />
            <Input label="Email" type="email" {...createForm.register('email')} error={createForm.formState.errors.email?.message} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nombre completo" {...createForm.register('full_name')} error={createForm.formState.errors.full_name?.message} />
            <Input label="Contraseña" type="password" {...createForm.register('password')} error={createForm.formState.errors.password?.message} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Rol</label>
            <select {...createForm.register('role')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-48">
              <option value="cashier">Cajero</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="flex gap-3">
            <Button type="submit" loading={createMutation.isPending}>Crear usuario</Button>
            <Button type="button" variant="secondary" onClick={closeForm}>Cancelar</Button>
          </div>
        </form>
      )}

      {/* Edit form */}
      {mode === 'edit' && editingUser && (
        <form
          onSubmit={editForm.handleSubmit(d => updateMutation.mutate({ id: editingUser.id, data: d }))}
          className="bg-white rounded-xl p-6 shadow-sm border border-brand-100 mb-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Editar: <span className="text-brand-900">{editingUser.username}</span></h3>
            <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nombre completo" {...editForm.register('full_name')} error={editForm.formState.errors.full_name?.message} />
            <Input label="Email" type="email" {...editForm.register('email')} error={editForm.formState.errors.email?.message} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Rol</label>
              <select {...editForm.register('role')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="cashier">Cajero</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <Input
              label="Nueva contraseña (dejar en blanco para no cambiar)"
              type="password"
              {...editForm.register('password')}
              error={editForm.formState.errors.password?.message}
              placeholder="••••••"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" {...editForm.register('is_active')} className="rounded" />
            Usuario activo
          </label>
          <div className="flex gap-3">
            <Button type="submit" loading={updateMutation.isPending}>Guardar cambios</Button>
            <Button type="button" variant="secondary" onClick={closeForm}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 border-b border-gray-100 flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage(); }}
              placeholder="Buscar por nombre, usuario o email..."
              className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); resetPage(); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Todos los roles</option>
              <option value="admin">Administrador</option>
              <option value="cashier">Cajero</option>
            </select>
          </div>
          {(search || roleFilter) && (
            <button
              onClick={() => { setSearch(''); setRoleFilter(''); resetPage(); }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              <X size={14} /> Limpiar
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-brand-900 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-cards w-full text-sm min-w-[420px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Usuario</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Email</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Rol</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageItems.map(u => (
                  <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${editingUser?.id === u.id ? 'bg-brand-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                    <td data-label="Usuario" className="px-4 py-3 text-gray-600 font-mono text-xs hidden sm:table-cell">{u.username}</td>
                    <td data-label="Email" className="px-4 py-3 text-gray-600 hidden md:table-cell">{u.email}</td>
                    <td data-label="Rol" className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                      }`}>{u.role === 'admin' ? 'Admin' : 'Cajero'}</span>
                    </td>
                    <td data-label="Estado" className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>{u.is_active ? 'Activo' : 'Inactivo'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(u)}
                          title="Editar"
                          className="p-1.5 rounded hover:bg-brand-100 text-brand-600 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          title="Desactivar"
                          disabled={u.id === me?.id || deleteMutation.isPending}
                          className="p-1.5 rounded hover:bg-red-100 text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                      {search || roleFilter ? 'No hay usuarios que coincidan con la búsqueda' : 'No hay usuarios registrados'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={safePage}
          pages={pages}
          total={filtered.length}
          size={size}
          onPage={setPage}
          onSizeChange={s => { setSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}
