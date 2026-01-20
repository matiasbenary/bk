export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'loading';
export interface StrypeTransaction {
  id: number;
  email: string;
  stripe_id: string;
  transaction_id: string | null;
  status: TransactionStatus;
  amount_cents: number | null;
  product_name: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface HotPayTransaction {
  id: number;
  email: string;
  status: TransactionStatus;
  amount_cents: number | null;
  product_name: string | null;
  transaction_id: string;
  near_transaction_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  stripe_product_id: string | null;
  hotpay_item_id: string | null;
  created_at: string;
}

export interface User {
  userId: number;
  email: string;
  name: string;
}

export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  sub: string;
  given_name?: string;
  family_name?: string;
}
