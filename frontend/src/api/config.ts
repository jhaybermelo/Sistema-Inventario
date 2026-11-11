import api from './client';
import type { BusinessConfig } from '../types';

export interface PublicConfig {
  business_name: string;
  logo_url: string | null;
  currency_symbol: string;
}

export const getPublicConfig = async (): Promise<PublicConfig> => {
  const res = await api.get<PublicConfig>('/config/public');
  return res.data;
};

export const getConfig = async (): Promise<BusinessConfig> => {
  const res = await api.get<BusinessConfig>('/config');
  return res.data;
};

export const uploadLogo = async (file: File): Promise<void> => {
  const formData = new FormData();
  formData.append('file', file);
  await api.post('/config/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
