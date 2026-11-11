import { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Upload, ImageIcon } from 'lucide-react';
import api from '../api/client';
import { uploadLogo } from '../api/config';
import type { BusinessConfig } from '../types';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export function Config() {
  const qc = useQueryClient();
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: config } = useQuery<BusinessConfig>({
    queryKey: ['config'],
    queryFn: async () => (await api.get('/config')).data,
  });

  const { register, handleSubmit, reset } = useForm<Partial<BusinessConfig>>();

  useEffect(() => {
    if (config) reset(config);
  }, [config, reset]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      await uploadLogo(file);
      toast.success('Logo actualizado');
      qc.invalidateQueries({ queryKey: ['config'] });
      qc.invalidateQueries({ queryKey: ['config-public'] });
    } catch {
      toast.error('Error al subir el logo');
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateMutation = useMutation({
    mutationFn: (data: Partial<BusinessConfig>) => api.put('/config', data),
    onSuccess: () => {
      toast.success('Configuración guardada');
      qc.invalidateQueries({ queryKey: ['config'] });
    },
    onError: () => toast.error('Error al guardar'),
  });

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Configuración del Negocio</h2>

      <form
        onSubmit={handleSubmit(d => updateMutation.mutate(d))}
        className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nombre del negocio" {...register('business_name')} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Tipo de negocio</label>
            <select {...register('business_type')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="general">General</option>
              <option value="farmacia">Farmacia / Droguería</option>
              <option value="heladeria">Heladería</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="NIT / RUT" {...register('nit')} />
          <Input label="Teléfono" {...register('phone')} />
        </div>

        <Input label="Dirección" {...register('address')} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Tasa de impuesto (%)" type="number" step="0.01" {...register('tax_rate')} />
          <Input label="Símbolo de moneda" {...register('currency_symbol')} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Pie de recibo</label>
          <textarea
            {...register('receipt_footer')}
            rows={3}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Ej: Gracias por su compra. No se aceptan devoluciones."
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" {...register('low_stock_alert_enabled')} className="rounded" />
          Activar alertas de stock bajo
        </label>

        <Button type="submit" loading={updateMutation.isPending}>Guardar configuración</Button>
      </form>

      {/* Logo */}
      <div className="mt-8 bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Logo del Negocio</h3>
        <p className="text-sm text-gray-500">
          Se mostrará en el menú lateral, dashboard y pantalla de inicio de sesión.
        </p>

        <div className="flex items-center gap-5">
          <div className="h-24 w-24 flex-shrink-0 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
            {config?.logo_url ? (
              <img src={config.logo_url} alt="Logo" className="h-full w-full object-contain p-1" />
            ) : (
              <ImageIcon size={32} className="text-gray-300" />
            )}
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={logoUploading}
              className="flex items-center gap-2 bg-brand-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-60"
            >
              <Upload size={15} />
              {logoUploading ? 'Subiendo...' : config?.logo_url ? 'Cambiar logo' : 'Subir logo'}
            </button>
            <p className="text-xs text-gray-400">PNG, JPG o SVG — fondo transparente recomendado</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
        </div>
      </div>

      {/* Notification settings */}
      <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Notificaciones de Stock Bajo</h3>
        <p className="text-sm text-gray-500">
          Cuando un producto alcance su umbral mínimo, el sistema enviará alertas automáticas a los canales habilitados.
        </p>

        <form
          onSubmit={handleSubmit(d => updateMutation.mutate(d))}
          className="space-y-4"
        >
          {/* Email */}
          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input type="checkbox" {...register('email_notifications_enabled')} className="rounded" />
              Notificaciones por correo electrónico (Gmail)
            </label>
            <Input
              label="Correos destinatarios (separados por coma)"
              placeholder="admin@empresa.com, gerente@empresa.com"
              {...register('notify_email')}
            />
            <p className="text-xs text-gray-400">
              Requiere configurar <code className="bg-gray-100 px-1 rounded">SMTP_USER</code> y <code className="bg-gray-100 px-1 rounded">SMTP_PASSWORD</code> en el archivo <code className="bg-gray-100 px-1 rounded">.env</code> del servidor.
            </p>
          </div>

          {/* WhatsApp */}
          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input type="checkbox" {...register('whatsapp_notifications_enabled')} className="rounded" />
              Notificaciones por WhatsApp (CallMeBot)
            </label>
            <Input
              label="Números de WhatsApp (formato internacional, separados por coma)"
              placeholder="+573001234567, +573009876543"
              {...register('notify_whatsapp')}
            />
            <p className="text-xs text-gray-400">
              Requiere activar CallMeBot enviando "I allow callmebot to send me messages" al número +34 644 23 49 10 en WhatsApp, y configurar <code className="bg-gray-100 px-1 rounded">CALLMEBOT_APIKEY</code> en <code className="bg-gray-100 px-1 rounded">.env</code>.
            </p>
          </div>

          <Button type="submit" loading={updateMutation.isPending}>Guardar notificaciones</Button>
        </form>
      </div>
    </div>
  );
}
