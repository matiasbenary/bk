import Database from 'better-sqlite3';
import path from 'path';
import { Transaction, User, CryptoTransaction } from './types';

const db = new Database(path.join(__dirname, '../transactions.db'));

function initializeTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
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
    CREATE TABLE IF NOT EXISTS crypto_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      amount_cents INTEGER,
      product_name TEXT,
      transacction_id TEXT,
      near_transaction_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    INSERT INTO transactions (email, stripe_id, session_id, amount_cents, product_name)
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
    UPDATE transactions
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
    SELECT * FROM transactions
    WHERE session_id = ?
  `);

  return stmt.get(session_id) as Transaction | undefined;
}

export function getAllTransaction() {
  const stmt = db.prepare(`
    SELECT * FROM transactions
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

export function getUserById(id: number): User | undefined {
  const stmt = db.prepare(`
    SELECT * FROM users
    WHERE id = ?
  `);

  return stmt.get(id) as User | undefined;
}

export function createCryptoTransaction(data: {
  email: string;
  transacction_id: string;
  amount_cents: number;
  product_name: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO crypto_transactions (email, transacction_id, amount_cents, product_name)
    VALUES (?, ?, ?, ?)
  `);

  return stmt.run(data.email, data.transacction_id, data.amount_cents, data.product_name);
}

export function getCryptoTransactionByTransacctionId(transacction_id: string): CryptoTransaction | undefined {
  const stmt = db.prepare(`
    SELECT * FROM crypto_transactions
    WHERE transacction_id = ?
  `);

  return stmt.get(transacction_id) as CryptoTransaction | undefined;
}

export function getAllCryptoTransactions() {
  const stmt = db.prepare(`
    SELECT * FROM crypto_transactions
    ORDER BY created_at DESC
  `);

  return stmt.all();
}

export function updateCryptoTransactionStatus(
  transacction_id: string,
  status: string,
  near_transaction_hash?: string
) {
  const stmt = db.prepare(`
    UPDATE crypto_transactions
    SET status = ?,
        near_transaction_hash = COALESCE(?, near_transaction_hash),
        updated_at = CURRENT_TIMESTAMP
    WHERE transacction_id = ?
  `);

  return stmt.run(status, near_transaction_hash, transacction_id);
}

export function refreshDatabase() {
  db.exec('DROP TABLE IF EXISTS transactions');
  db.exec('DROP TABLE IF EXISTS users');
  db.exec('DROP TABLE IF EXISTS crypto_transactions');
  initializeTables();
}

export default db;
