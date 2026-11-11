import api from './client';
import type { Purchase, PurchaseListResponse } from '../types';

export const createPurchase = async (data: {
  supplier_name?: string;
  items: { product_id: number; quantity: number; unit_cost: number }[];
  notes?: string;
  update_costs?: boolean;
}): Promise<Purchase> => {
  const res = await api.post<Purchase>('/purchases', data);
  return res.data;
};

export const getPurchases = async (params?: {
  page?: number;
  size?: number;
  supplier_name?: string;
  date_from?: string;
  date_to?: string;
}): Promise<PurchaseListResponse> => {
  const res = await api.get<PurchaseListResponse>('/purchases', { params });
  return res.data;
};

export const getPurchase = async (id: number): Promise<Purchase> => {
  const res = await api.get<Purchase>(`/purchases/${id}`);
  return res.data;
};

export const cancelPurchase = async (id: number): Promise<Purchase> => {
  const res = await api.post<Purchase>(`/purchases/${id}/cancel`);
  return res.data;
};
