import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { refreshDatabase } from "./database";
import { errorHandler } from "./middleware/errorHandler";
import { authenticateToken } from "./middleware/auth";

import { googleAuth, googleCallback, getMe } from "./controllers/auth";
import stripe from "./controllers/stripe";
import hotPay from "./controllers/hot-pay";
import { create as createProduct, list as listProducts } from "./controllers/product";

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

app.use(express.json());

// Auth routes
app.get("/auth/google", googleAuth);
app.get("/auth/google/callback", googleCallback);
app.get("/auth/me", authenticateToken, getMe);

// Stripe routes
app.post("/stripe-webhook", express.raw({ type: "application/json" }), stripe.webHook);
app.post("/stripe-session", authenticateToken, stripe.createSession);
app.get("/stripe-status/:sessionId", authenticateToken, stripe.getStatus);
app.get("/stripe-transactions", authenticateToken, stripe.getTransactions);

// Hot Pay routes
app.post("/hot-pay-webhook", hotPay.webHook);
app.post("/hot-pay-session", authenticateToken, hotPay.createSession);
app.get("/hot-pay-status/:sessionId", authenticateToken, hotPay.getStatus);
app.get("/hot-pay-transactions", authenticateToken, hotPay.getTransactions);

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
