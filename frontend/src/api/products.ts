import api from './client';
import type { Product, ProductListResponse, Category } from '../types';

export const getProducts = async (params?: {
  q?: string;
  category_id?: number;
  low_stock_only?: boolean;
  page?: number;
  size?: number;
  sort_by?: string;
  sort_dir?: string;
}): Promise<ProductListResponse> => {
  const res = await api.get<ProductListResponse>('/products', { params });
  return res.data;
};

export const getProduct = async (id: number): Promise<Product> => {
  const res = await api.get<Product>(`/products/${id}`);
  return res.data;
};

export const lookupProducts = async (q: string): Promise<Product[]> => {
  const res = await api.get<Product[]>('/products/lookup', { params: { q } });
  return res.data;
};

export const createProduct = async (data: Partial<Product>): Promise<Product> => {
  const res = await api.post<Product>('/products', data);
  return res.data;
};

export const updateProduct = async (id: number, data: Partial<Product>): Promise<Product> => {
  const res = await api.put<Product>(`/products/${id}`, data);
  return res.data;
};

export const deleteProduct = async (id: number): Promise<void> => {
  await api.delete(`/products/${id}`);
};

export const getCategories = async (): Promise<Category[]> => {
  const res = await api.get<Category[]>('/products/categories');
  return res.data;
};

export const createCategory = async (data: { name: string; description?: string }): Promise<Category> => {
  const res = await api.post<Category>('/products/categories', data);
  return res.data;
};

export const updateCategory = async (id: number, data: { name?: string; description?: string }): Promise<Category> => {
  const res = await api.put<Category>(`/products/categories/${id}`, data);
  return res.data;
};

export const deleteCategory = async (id: number): Promise<void> => {
  await api.delete(`/products/categories/${id}`);
};

export const getLowStockCount = async (): Promise<number> => {
  const res = await api.get<{ count: number }>('/products/low-stock-count');
  return res.data.count;
};

export const previewCSV = async (file: File) => {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/products/import/preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const confirmCSV = async (file: File) => {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/products/import/confirm', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};
