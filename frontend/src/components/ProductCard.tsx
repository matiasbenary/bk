import { useState } from 'react';
import { API_URL } from '../config';
import type { Product } from '../types';

interface ProductCardProps {
  userEmail: string | null;
  product: Product;
}

const ProductCard = ({ userEmail, product }: ProductCardProps) => {
  const [loading, setLoading] = useState(false);
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuyNow = async () => {
    if (!userEmail) {
      setError('Please log in first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');

      const response = await fetch(`${API_URL}/stripe-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: userEmail,
          productId: product.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment session');
      }

      const session = await response.json();
      window.location.href = session.sessionUrl;


    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCryptoBuy = async () => {
    if (!userEmail) {
      setError('Please log in first');
      return;
    }

    setCryptoLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');

      const response = await fetch(`${API_URL}/hot-pay-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: userEmail,
          productId: product.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create crypto payment session');
      }

      const session = await response.json();
      const paymentUrl = `${session.paymentUrl}&memo=${session.sessionId}`;
      window.open(paymentUrl, '_blank');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Crypto payment failed');
    } finally {
      setCryptoLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-64 object-cover object-center"
        />
      ) : (
        <div className="w-full h-64 bg-gray-700 flex items-center justify-center text-gray-400">
          No image
        </div>
      )}
      <div className="p-4">
        <h3 className="text-xl font-semibold text-white mb-2">{product.name}</h3>
        <p className="text-2xl font-bold text-indigo-400 mb-4">${(product.price / 100).toFixed(2)}</p>
        {error && (
          <p className="text-red-400 text-sm mb-2">{error}</p>
        )}
        <div className="space-y-2">
          <button
            onClick={handleBuyNow}
            disabled={loading || cryptoLoading}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Buy with Card'}
          </button>
          <button
            onClick={handleCryptoBuy}
            disabled={loading || cryptoLoading}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {cryptoLoading ? 'Processing...' : 'Pay with Crypto'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
