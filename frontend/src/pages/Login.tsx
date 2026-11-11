import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { login as loginApi } from '../api/auth';
import { getPublicConfig } from '../api/config';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Pill } from 'lucide-react';

const schema = z.object({
  username: z.string().min(1, 'Ingresa tu usuario'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});

type FormData = z.infer<typeof schema>;

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const { data: publicConfig } = useQuery({
    queryKey: ['config-public'],
    queryFn: getPublicConfig,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await loginApi(data.username, data.password);
      await login(res.access_token);
      navigate('/dashboard');
    } catch {
      toast.error('Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 to-brand-700 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          {publicConfig?.logo_url ? (
            <img
              src={publicConfig.logo_url}
              alt="Logo"
              className="h-24 w-24 object-contain mb-3"
            />
          ) : (
            <div className="bg-brand-900 p-4 rounded-full mb-4">
              <Pill className="text-white" size={28} />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900 text-center">
            {publicConfig?.business_name ?? 'Droguería Central'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Ingresa tus credenciales para continuar</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Usuario"
            placeholder="usuario"
            autoComplete="username"
            autoFocus
            {...register('username')}
            error={errors.username?.message}
          />
          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            {...register('password')}
            error={errors.password?.message}
          />
          <Button type="submit" size="lg" loading={loading} className="w-full mt-2">
            Iniciar sesión
          </Button>
        </form>
      </div>
    </div>
  );
}
