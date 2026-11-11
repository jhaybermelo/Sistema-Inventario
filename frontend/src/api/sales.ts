import api from './client';
import type { Sale, SaleListResponse } from '../types';

export const createSale = async (data: {
  items: { product_id: number; quantity: number; discount?: number }[];
  payment_method: string;
  discount_amount?: number;
  notes?: string;
  customer_id?: number;
  paid_amount?: number;
}): Promise<Sale> => {
  const res = await api.post<Sale>('/sales', data);
  return res.data;
};

export const getSales = async (params?: {
  date_from?: string;
  date_to?: string;
  payment_method?: string;
  status?: string;
  sale_number?: string;
  page?: number;
  size?: number;
}): Promise<SaleListResponse> => {
  const res = await api.get<SaleListResponse>('/sales', { params });
  return res.data;
};

export const getSale = async (id: number): Promise<Sale> => {
  const res = await api.get<Sale>(`/sales/${id}`);
  return res.data;
};

export const cancelSale = async (id: number): Promise<Sale> => {
  const res = await api.post<Sale>(`/sales/${id}/cancel`);
  return res.data;
};
