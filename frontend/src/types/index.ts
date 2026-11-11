export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'admin' | 'cashier';
  is_active: boolean;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  price: string;
  cost: string | null;
  quantity: number;
  low_stock_threshold: number;
  category_id: number | null;
  category: Category | null;
  is_active: boolean;
  attributes: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  is_low_stock: boolean;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface SaleItem {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  unit_price: string;
  quantity: number;
  discount: string;
  line_total: string;
}

export interface Sale {
  id: number;
  sale_number: string;
  user_id: number;
  customer_id: number | null;
  customer_full_name: string | null;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total: string;
  paid_amount: string;
  credit_amount: string;
  payment_method: string;
  status: string;
  notes: string | null;
  created_at: string;
  items: SaleItem[];
}

export interface SaleListResponse {
  items: Sale[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

export interface BusinessConfig {
  id: number;
  business_name: string;
  business_type: string;
  nit: string | null;
  address: string | null;
  phone: string | null;
  logo_path: string | null;
  logo_url: string | null;
  receipt_footer: string | null;
  tax_rate: string;
  currency_symbol: string;
  low_stock_alert_enabled: boolean;
  notify_email: string | null;
  notify_whatsapp: string | null;
  email_notifications_enabled: boolean;
  whatsapp_notifications_enabled: boolean;
}

export interface PurchaseItem {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_cost: string;
  line_total: string;
}

export interface Purchase {
  id: number;
  purchase_number: string;
  supplier_name: string | null;
  user_id: number;
  total: string;
  status: 'confirmed' | 'cancelled';
  notes: string | null;
  created_at: string;
  items: PurchaseItem[];
}

export interface PurchaseListResponse {
  items: Purchase[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface DashboardData {
  today: {
    date: string;
    transaction_count: number;
    total_revenue: string;
    total_tax: string;
  };
  week: Array<{
    date: string;
    transaction_count: number;
    total_revenue: string;
    total_tax: string;
  }>;
  low_stock_count: number;
}
