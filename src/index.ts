import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { refreshDatabase } from "./database";
import { errorHandler } from "./middleware/errorHandler";
import { authenticateToken } from "./middleware/auth";

import { googleAuth, googleCallback, getMe } from "./controllers/authController";
import { stripeWebhook, createSession, getStatus, getTransactions } from "./controllers/paymentController";
import { cryptoWebhook, createCryptoSession, getCryptoStatus, getCryptoTransactions } from "./controllers/cryptoController";
import { create as createProduct, list as listProducts } from "./controllers/productController";

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const allowedOrigins = [
  "http://localhost:5173",
  ...(FRONTEND_URL !== "http://localhost:5173" ? [FRONTEND_URL] : [])
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Stripe webhook (needs raw body)
app.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

app.use(express.json());

// Crypto webhook
app.post("/crypto-webhook", cryptoWebhook);

// Auth routes
app.get("/auth/google", googleAuth);
app.get("/auth/google/callback", googleCallback);
app.get("/auth/me", authenticateToken, getMe);

// Payment routes
app.post("/create-session", authenticateToken, createSession);
app.get("/status/:sessionId", authenticateToken, getStatus);
app.get("/transactions", authenticateToken, getTransactions);

// Crypto routes
app.post("/create-crypto-session", authenticateToken, createCryptoSession);
app.get("/crypto-status/:transactionId", authenticateToken, getCryptoStatus);
app.get("/crypto-transactions", authenticateToken, getCryptoTransactions);

// Product routes
app.post("/products", authenticateToken, createProduct);
app.get("/products", authenticateToken, listProducts);

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Database refresh
app.post("/refresh-database", (_req: Request, res: Response, next: NextFunction) => {
  try {
    refreshDatabase();
    res.json({ message: "Database refreshed successfully" });
  } catch (err) {
    next(err);
  }
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
