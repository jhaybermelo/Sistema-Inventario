import api from './client';

export interface CreditPaymentItem {
  id: number;
  amount: string;
  payment_method: string;
  notes: string | null;
  created_at: string;
}

export interface CustomerCreditItem {
  id: number;
  customer_id: number;
  sale_id: number;
  sale_number: string;
  original_amount: string;
  paid_amount: string;
  balance: string;
  status: 'pending' | 'partial' | 'paid';
  notes: string | null;
  created_at: string;
  payments: CreditPaymentItem[];
  customer_full_name?: string;
}

export interface CustomerCreditSummary {
  total_credit: string;
  total_paid: string;
  total_balance: string;
  credits: CustomerCreditItem[];
}

export interface CreditListResponse {
  items: (CustomerCreditItem & { customer_full_name: string })[];
  total: number;
  page: number;
  pages: number;
}

export const getCustomerCredits = async (customerId: number): Promise<CustomerCreditSummary> => {
  const res = await api.get<CustomerCreditSummary>(`/customers/${customerId}/credits`);
  return res.data;
};

export const listCredits = async (params?: { status?: string; page?: number; size?: number }): Promise<CreditListResponse> => {
  const res = await api.get<CreditListResponse>('/credits', { params });
  return res.data;
};

export const addPayment = async (creditId: number, data: { amount: number | string; payment_method: string; notes?: string }): Promise<CustomerCreditItem> => {
  const res = await api.post<CustomerCreditItem>(`/credits/${creditId}/payments`, data);
  return res.data;
};
