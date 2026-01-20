export interface Transaction {
  id: number;
  email: string;
  stripe_id: string;
  transaction_id: string | null;
  status: 'pending' | 'completed' | 'failed';
  amount_cents: number | null;
  product_name: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionData {
  email: string;
  session_id: string;
  amount_cents: number;
  product_name: string;
}

export interface ReconciliationReport {
  orphaned: Transaction[];
  duplicates: any[];
  stats: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
  };
  matched: number;
}

export interface User {
  id: number;
  google_id: string;
  email: string;
  name: string;
  picture: string;
  created_at: string;
}

export interface JWTPayload {
  userId: number;
  email: string;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  stripe_product_id: string | null;
  hot_pay_item_id: string | null;
  created_at: string;
}

export interface HotTransaction {
  id: number;
  user_id: number | null;
  email: string;
  item_id: string;
  merchant_id: string;
  memo: string;
  header: string;
  description: string;
  token: string;
  amount: string;
  redirect_url: string;
  icon: string;
  webhook_url: string;
  status: 'pending' | 'completed' | 'failed';
  product_name: string;
  created_at: string;
  updated_at: string;
}
