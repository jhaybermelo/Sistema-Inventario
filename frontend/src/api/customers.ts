import api from './client';

export interface Customer {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  document_id: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  total_purchases: number;
  total_spent: string;
  last_purchase_at: string | null;
}

export interface CustomerListItem {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  document_id: string | null;
  is_active: boolean;
  created_at: string;
  total_purchases: number;
  total_spent: string;
}

export interface CustomerListResponse {
  items: CustomerListItem[];
  total: number;
  page: number;
  pages: number;
}

export interface CustomerCreate {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  document_id?: string | null;
  address?: string | null;
  notes?: string | null;
}

export const getCustomers = async (params?: {
  q?: string;
  page?: number;
  size?: number;
  show_inactive?: boolean;
  sort_by?: string;
  sort_dir?: string;
}): Promise<CustomerListResponse> => {
  const res = await api.get<CustomerListResponse>('/customers', { params });
  return res.data;
};

export const searchCustomers = async (q: string): Promise<CustomerListItem[]> => {
  if (!q || q.length < 1) return [];
  const res = await api.get<CustomerListResponse>('/customers', { params: { q, size: 10 } });
  return res.data.items;
};

export const getCustomer = async (id: number): Promise<Customer> => {
  const res = await api.get<Customer>(`/customers/${id}`);
  return res.data;
};

export const createCustomer = async (data: CustomerCreate): Promise<Customer> => {
  const res = await api.post<Customer>('/customers', data);
  return res.data;
};

export const updateCustomer = async (id: number, data: Partial<CustomerCreate> & { is_active?: boolean }): Promise<Customer> => {
  const res = await api.put<Customer>(`/customers/${id}`, data);
  return res.data;
};

export const deleteCustomer = async (id: number): Promise<void> => {
  await api.delete(`/customers/${id}`);
};

export const getCustomerSales = async (id: number, params?: { page?: number; size?: number }) => {
  const res = await api.get(`/customers/${id}/sales`, { params });
  return res.data;
};
