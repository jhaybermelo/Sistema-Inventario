import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../api/client';
import { Pagination } from '../components/ui/Pagination';
import { Bell, Mail, MessageCircle, CheckCircle, XCircle, MinusCircle, Trash2 } from 'lucide-react';

interface NotificationLogEntry {
  id: number;
  channel: 'email' | 'whatsapp';
  status: 'success' | 'failed' | 'skipped';
  recipient: string;
  message: string;
  error: string | null;
  created_at: string;
}

interface LogResponse {
  items: NotificationLogEntry[];
  total: number;
  page: number;
  pages: number;
}

const STATUS_CONFIG = {
  success: { label: 'Enviado',  icon: CheckCircle,  cls: 'bg-green-100 text-green-700' },
  failed:  { label: 'Error',    icon: XCircle,      cls: 'bg-red-100 text-red-700' },
  skipped: { label: 'Omitido', icon: MinusCircle,  cls: 'bg-gray-100 text-gray-500' },
};

const CHANNEL_CONFIG = {
  email:    { label: 'Email',    icon: Mail,          cls: 'bg-brand-100 text-brand-700' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, cls: 'bg-green-100 text-green-700' },
};

export function NotificationLog() {
  const qc = useQueryClient();
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const { data, isLoading } = useQuery<LogResponse>({
    queryKey: ['notification-logs', channel, status, page, size],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (channel) params.set('channel', channel);
      if (status) params.set('status', status);
      return (await api.get(`/notifications?${params}`)).data;
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete('/notifications'),
    onSuccess: () => {
      toast.success('Historial eliminado');
      qc.invalidateQueries({ queryKey: ['notification-logs'] });
    },
    onError: () => toast.error('Error al eliminar el historial'),
  });

  const handleClear = () => {
    if (!confirm('¿Eliminar todo el historial de notificaciones? Esta acción no se puede deshacer.')) return;
    clearMutation.mutate();
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell size={22} /> Registro de Notificaciones
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Historial de envíos de alertas de stock bajo por email y WhatsApp
          </p>
        </div>
        <button
          onClick={handleClear}
          disabled={clearMutation.isPending || (data?.total ?? 0) === 0}
          className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 size={15} /> Limpiar historial
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Filters */}
        <div className="p-4 border-b border-gray-100 flex gap-3 flex-wrap items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Canal</label>
            <select
              value={channel}
              onChange={e => { setChannel(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Todos</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Estado</label>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Todos</option>
              <option value="success">Enviado</option>
              <option value="failed">Error</option>
              <option value="skipped">Omitido</option>
            </select>
          </div>
          {(channel || status) && (
            <button
              onClick={() => { setChannel(''); setStatus(''); setPage(1); }}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-brand-900 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-cards w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha y hora</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Canal</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Destinatario</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.items.map(entry => {
                  const statusCfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.failed;
                  const channelCfg = CHANNEL_CONFIG[entry.channel] ?? CHANNEL_CONFIG.email;
                  const StatusIcon = statusCfg.icon;
                  const ChannelIcon = channelCfg.icon;
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString('es', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td data-label="Canal" className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${channelCfg.cls}`}>
                          <ChannelIcon size={12} /> {channelCfg.label}
                        </span>
                      </td>
                      <td data-label="Estado" className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.cls}`}>
                          <StatusIcon size={12} /> {statusCfg.label}
                        </span>
                      </td>
                      <td data-label="Destinatario" className="px-4 py-3 text-gray-600 text-xs hidden md:table-cell max-w-[180px] truncate" title={entry.recipient}>
                        {entry.recipient}
                      </td>
                      <td data-label="Detalle" className="px-4 py-3 max-w-xs">
                        <p className="text-gray-700 text-xs">{entry.message}</p>
                        {entry.error && (
                          <p className="text-red-500 text-xs mt-0.5 font-mono">{entry.error}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                      No hay registros de notificaciones
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
    </div>
  );
}
