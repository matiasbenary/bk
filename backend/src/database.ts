import Database from 'better-sqlite3';
import path from 'path';
import { Transaction, User, HotTransaction, Product } from './types';

const db = new Database(path.join(__dirname, '../transactions.db'));

function initializeTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stripe_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      stripe_id TEXT UNIQUE NOT NULL,
      transaction_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      amount_cents INTEGER,
      product_name TEXT,
      session_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      picture TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS hot_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      amount_cents INTEGER,
      product_name TEXT,
      transaction_id TEXT,
      near_transaction_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      image_url TEXT,
      stripe_product_id TEXT,
      hot_pay_item_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

initializeTables();


export function createTransaction(data: {
  email: string;
  session_id: string;
  amount_cents: number;
  product_name: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO stripe_transactions (email, stripe_id, session_id, amount_cents, product_name)
    VALUES (?, ?, ?, ?, ?)
  `);

  return stmt.run(
    data.email,
    `temp_${data.session_id}`,
    data.session_id,
    data.amount_cents,
    data.product_name
  );
}

export function updateTransactionStatus(session_id: string, status: string, stripe_id?: string, transaction_id?: string) {
  const stmt = db.prepare(`
    UPDATE stripe_transactions
    SET status = ?,
        stripe_id = COALESCE(?, stripe_id),
        transaction_id = COALESCE(?, transaction_id),
        updated_at = CURRENT_TIMESTAMP
    WHERE session_id = ?
  `);

  return stmt.run(status, stripe_id, transaction_id, session_id);
}

export function getTransactionBySessionId(session_id: string): Transaction | undefined {
  const stmt = db.prepare(`
    SELECT * FROM stripe_transactions
    WHERE session_id = ?
  `);

  return stmt.get(session_id) as Transaction | undefined;
}

export function getAllTransaction() {
  const stmt = db.prepare(`
    SELECT * FROM stripe_transactions
  `);

  return stmt.all() as Transaction[];
}

export function createOrUpdateUser(data: {
  google_id: string;
  email: string;
  name: string;
  picture: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO users (google_id, email, name, picture)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(google_id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      picture = excluded.picture
  `);

  return stmt.run(data.google_id, data.email, data.name, data.picture);
}

export function getUserByGoogleId(google_id: string): User | undefined {
  const stmt = db.prepare(`
    SELECT * FROM users
    WHERE google_id = ?
  `);

  return stmt.get(google_id) as User | undefined;
}

export function createHotTransaction(data: {
  email: string;
  transaction_id: string;
  amount_cents: number;
  product_name: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO hot_transactions (email, transaction_id, amount_cents, product_name)
    VALUES (?, ?, ?, ?)
  `);

  return stmt.run(data.email, data.transaction_id, data.amount_cents, data.product_name);
}

export function getHotTransactionByTransactionId(transaction_id: string): HotTransaction | undefined {
  const stmt = db.prepare(`
    SELECT * FROM hot_transactions
    WHERE transaction_id = ?
  `);

  return stmt.get(transaction_id) as HotTransaction | undefined;
}

export function getAllHotTransactions() {
  const stmt = db.prepare(`
    SELECT * FROM hot_transactions
    ORDER BY created_at DESC
  `);

  return stmt.all();
}

export function updateHotTransactionStatus(
  transaction_id: string,
  status: string,
  near_transaction_hash?: string
) {
  const stmt = db.prepare(`
    UPDATE hot_transactions
    SET status = ?,
        near_transaction_hash = COALESCE(?, near_transaction_hash),
        updated_at = CURRENT_TIMESTAMP
    WHERE transaction_id = ?
  `);

  return stmt.run(status, near_transaction_hash, transaction_id);
}

export function createProduct(data: {
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  stripe_product_id?: string;
  hot_pay_item_id?: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO products (name, description, price, image_url, stripe_product_id, hot_pay_item_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    data.name,
    data.description || null,
    data.price,
    data.image_url || null,
    data.stripe_product_id || null,
    data.hot_pay_item_id || null
  );
}

export function getAllProducts(): Product[] {
  const stmt = db.prepare('SELECT * FROM products ORDER BY created_at DESC');
  return stmt.all() as Product[];
}

export function getProductById(id: number): Product | undefined {
  const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
  return stmt.get(id) as Product | undefined;
}

export function refreshDatabase() {
  db.exec('DROP TABLE IF EXISTS transactions');
  db.exec('DROP TABLE IF EXISTS users');
  db.exec('DROP TABLE IF EXISTS hot_transactions');
  db.exec('DROP TABLE IF EXISTS products');
  initializeTables();
}

export default db;
