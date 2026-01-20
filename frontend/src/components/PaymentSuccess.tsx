import { useEffect, useState } from 'react';
import { API_URL } from '../config';
import type { TransactionStatus } from '../types';

interface PaymentSuccessProps {
  sessionId: string;
  onContinue: () => void;
}

interface PaymentStatusResponse {
  status: TransactionStatus;
  transaction?: {
    status: string;
    [key: string]: unknown;
  };
}

async function getPaymentStatus(sessionId: string): Promise<PaymentStatusResponse> {
  const token = localStorage.getItem('authToken');

  const response = await fetch(`${API_URL}/stripe-status/${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch payment status: ${response.statusText}`);
  }
  return await response.json();
}

const PaymentSuccess = ({ sessionId, onContinue }: PaymentSuccessProps) => {
  const [status, setStatus] = useState<TransactionStatus>('loading');

  useEffect(() => {
    async function checkStatus() {
      const maxAttempts = 4;
      const delayMs = 3000;

      try {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const result = await getPaymentStatus(sessionId);
          setStatus(result.status);

          if (result.status === 'completed' || result.status === 'failed') {
            break;
          }

          if (result.status === 'pending' && attempt < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      } catch (err) {
        console.error('Error checking payment status:', err);
        setStatus('failed');
      }
    }
    checkStatus();
  }, [sessionId]);

  return (
    <div className="bg-gray-800 rounded-lg p-8 text-center max-w-md mx-auto">
      {status === 'loading' && (
        <div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mx-auto mb-4"></div>
          <p className="text-white">Verifying payment...</p>
        </div>
      )}
      {status === 'completed' && (
        <>
          <div className="text-green-400 text-6xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-green-400 mb-4">Payment Successful!</h2>
          <p className="text-gray-300 mb-6">Thank you for your purchase of Dark Chocolate.</p>
        </>
      )}
      {status === 'pending' && (
        <>
          <div className="text-yellow-400 text-6xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-yellow-400 mb-4">Payment Processing</h2>
          <p className="text-gray-300 mb-6">Your payment is being verified. Please check back shortly.</p>
        </>
      )}
      {status === 'failed' && (
        <>
          <div className="text-red-400 text-6xl mb-4">✗</div>
          <h2 className="text-2xl font-bold text-red-400 mb-4">Payment Failed</h2>
          <p className="text-gray-300 mb-6">There was an issue processing your payment.</p>
        </>
      )}
      <button
        onClick={onContinue}
        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
      >
        Continue Shopping
      </button>
    </div>
  );
};

export default PaymentSuccess;
