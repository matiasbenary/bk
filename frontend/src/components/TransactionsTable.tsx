import { useState, useEffect } from "react";
import type { StrypeTransaction, HotPayTransaction } from "../types";
import { API_URL } from "../config";

type TransactionType = 'card' | 'crypto';

interface TransactionsTableProps {
  type: TransactionType;
}

const formatCurrency = (cents: number | null) => {
  if (cents === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "completed":
      return "text-green-400";
    case "pending":
      return "text-yellow-400";
    case "failed":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
};

const config = {
  card: {
    endpoint: '/stripe-transactions',
    title: 'Transaction History',
    loadingText: 'Loading transactions...',
    emptyText: 'No transactions found',
  },
  crypto: {
    endpoint: '/hot-pay-transactions',
    title: 'Crypto Transaction History',
    loadingText: 'Loading crypto transactions...',
    emptyText: 'No crypto transactions found',
  },
} as const;

const TransactionsTable = ({ type }: TransactionsTableProps) => {
  const [transactions, setTransactions] = useState<(StrypeTransaction | HotPayTransaction)[]>([]);
  const [loading, setLoading] = useState(true);

  const { endpoint, title, loadingText, emptyText } = config[type];
  const isCrypto = type === 'crypto';

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);

      const token = localStorage.getItem("authToken");

      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setTransactions(data.transactions);

      setLoading(false);
    };

    fetchTransactions();
  }, [endpoint]);

  if (loading) {
    return (
      <div className="px-8 py-8 bg-gray-800 rounded-2xl shadow-xl">
        <div className="text-center text-gray-400">{loadingText}</div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="px-8 py-8 bg-gray-800 rounded-2xl shadow-xl">
        <div className="text-center text-gray-400">{emptyText}</div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 bg-gray-800 rounded-2xl shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-300 font-medium">ID</th>
              <th className="text-left py-3 px-4 text-gray-300 font-medium">Email</th>
              <th className="text-left py-3 px-4 text-gray-300 font-medium">Product</th>
              <th className="text-left py-3 px-4 text-gray-300 font-medium">Amount</th>
              <th className="text-left py-3 px-4 text-gray-300 font-medium">Status</th>
              <th className="text-left py-3 px-4 text-gray-300 font-medium">Transaction ID</th>
              {isCrypto && (
                <th className="text-left py-3 px-4 text-gray-300 font-medium">NEAR Tx Hash</th>
              )}
              <th className="text-left py-3 px-4 text-gray-300 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const txId = tx.transaction_id;
              const nearHash = 'near_transaction_hash' in tx ? tx.near_transaction_hash : null;

              return (
                <tr
                  key={tx.id}
                  className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors"
                >
                  <td className="py-3 px-4 text-gray-400">#{tx.id}</td>
                  <td className="py-3 px-4 text-gray-400 text-sm">{tx.email}</td>
                  <td className="py-3 px-4 text-white">{tx.product_name || "N/A"}</td>
                  <td className="py-3 px-4 text-white font-medium">
                    {formatCurrency(tx.amount_cents)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`capitalize font-medium ${getStatusColor(tx.status)}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-sm font-mono">
                    {txId ? (isCrypto ? `${txId.substring(0, 8)}...` : txId) : 'N/A'}
                  </td>
                  {isCrypto && (
                    <td className="py-3 px-4 text-gray-400 text-sm font-mono">
                      {nearHash ? (
                        <a
                          href={`https://nearblocks.io/es/txns/${nearHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          {nearHash.substring(0, 8)}...
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </td>
                  )}
                  <td className="py-3 px-4 text-gray-400">{formatDate(tx.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionsTable;
