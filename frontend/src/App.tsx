import { useState } from "react";
import Navbar from "./components/Navbar";
import PaymentSuccess from "./components/PaymentSuccess";
import TransactionsTable from "./components/TransactionsTable";
import ProductList from "./components/ProductList";
import { useAuth } from "./hooks/useAuth";

const App = () => {
  const { user, loading } = useAuth();

  const [sessionId, setSessionId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('session_id');
  });

  const handleContinueShopping = () => {
    setSessionId(null);
    window.history.replaceState({}, '', '/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar />
      {!user ? (
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="w-full max-w-xl px-8 py-10 bg-gray-800 rounded-2xl shadow-xl outline outline-white/15">
            <div className="text-center space-y-6">
              <h1 className="text-3xl font-bold text-white">Welcome to Chocolate Shop</h1>
              <p className="text-gray-400">Sign in with Google to continue shopping</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8">
          {sessionId && (
            <div id="shop" className="max-w-md mx-auto space-y-6 mb-8">
              <PaymentSuccess
                sessionId={sessionId}
                onContinue={handleContinueShopping}
              />
            </div>
          )}

          <div className="max-w-6xl mx-auto space-y-8">
            <div id="products">
              <ProductList />
            </div>
            <div id="transactions" className="space-y-8">
              <TransactionsTable type="card" />
              <TransactionsTable type="crypto" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
