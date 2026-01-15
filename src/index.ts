import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import Stripe from "stripe";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import {
  updateTransactionStatus,
  createTransaction,
  getTransactionBySessionId,
  getAllTransaction,
  createOrUpdateUser,
  getUserByGoogleId,
  createCryptoTransaction,
  getAllCryptoTransactions,
  getCryptoTransactionByTransacctionId,
  updateCryptoTransactionStatus,
  refreshDatabase,
} from "./database";
import { errorHandler, ApiError } from "./middleware/errorHandler";
import { authenticateToken } from "./middleware/auth";
import { JWTPayload } from "./types";
import { randomUUID } from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const ITEM_URL = "https://pay.hot-labs.org/payment?item_id=083d02b3e74da7506491cd96763317073a47fc0d5fd3bec91fd5a737fd64d157&amount=0.01";

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

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

app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  console.log(req.body);
  
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;

  if (STRIPE_WEBHOOK_SECRET) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
    const session = event.data.object as Stripe.Checkout.Session;

    switch (event.type) {
      case "checkout.session.completed": {
        updateTransactionStatus(
          session.id,
          "completed",
          event.id,
          session.payment_intent as string
        );
        break;
      }
      
      case "checkout.session.expired": {
        updateTransactionStatus(session.id, "failed", event.id);
        console.log(`Payment expired for session: ${session.id}`);
        break;
      }
    }
  }
  res.json({ received: true });
});

app.use(express.json());

app.post("/crypto-webhook", async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("Crypto webhook received:", req.body);

    const { type, status, memo, near_trx } = req.body;

    if (type !== "PAYMENT_STATUS_UPDATE") {
      console.log(`Unhandled webhook type: ${type}`);
      res.json({ received: true });
      return;
    }

    const transactionId = memo;

    const dbStatus = status === "SUCCESS" ? "completed" : "pending";

    console.log(`Updating crypto transaction ${transactionId} to status: ${dbStatus}`);

    updateCryptoTransactionStatus(transactionId, dbStatus, near_trx);

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

app.get("/auth/google", (_req: Request, res: Response) => {
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "profile", "email"],
    state: Math.random().toString(36).substring(7),
  });
  res.redirect(authorizeUrl);
});

app.get("/auth/google/callback", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== "string") {
      throw new ApiError(400, "Authorization code missing");
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new ApiError(400, "Failed to get user info from Google");
    }

    createOrUpdateUser({
      google_id: payload.sub,
      email: payload.email!,
      name: payload.name || "",
      picture: payload.picture || "",
    });

    const user = getUserByGoogleId(payload.sub);

    const jwtPayload: JWTPayload = {
      userId: user?.id || 0,
      email: payload.email!,
      name: payload.name || "",
    };

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new ApiError(500, "JWT_SECRET not configured");
    }

    const token = jwt.sign(jwtPayload, jwtSecret, { expiresIn: "7d" });
    
    res.redirect(`${FRONTEND_URL}?token=${token}`);
  } catch (err) {
    next(err);
  }
});

app.get("/auth/me", authenticateToken, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

app.post(
  "/create-session",
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, productName, amount } = req.body;

      if (!email || !productName || !amount) {
        throw new ApiError(
          400,
          "Missing required fields: email, productName, amount"
        );
      }
      // https://docs.stripe.com/payments/checkout/how-checkout-works
      const session = await stripe.checkout.sessions.create({
        // line_items: [
        //   {
        //     price: "price_1Sn9pxRFZ3qOrNb5EMEUITd7",
        //     quantity: 1,
        //   },
        // ],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product: productName,
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${FRONTEND_URL}/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${FRONTEND_URL}/`,
        customer_email: email,
      });

      createTransaction({
        email,
        session_id: session.id,
        amount_cents: amount,
        product_name: productName,
      });

      res.json({
        sessionUrl: session.url,
        sessionId: session.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  "/create-crypto-session",
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, productName, amount } = req.body;

      if (!email || !productName || !amount) {
        throw new ApiError(
          400,
          "Missing required fields: email, productName, amount"
        );
      }

      const transactionId = randomUUID();
      createCryptoTransaction({
        email,
        transacction_id: transactionId,
        amount_cents: amount,
        product_name: productName,
      });

      res.json({
        paymentUrl: `${ITEM_URL}&transaction_id=${transactionId}`,
        sessionId: transactionId
      });
    } catch (err) {
      next(err);
    }
  }
);

app.get(
  "/status/:sessionId",
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      if (!sessionId || typeof sessionId !== "string") {
        throw new ApiError(400, "Missing session ID");
      }

      const transaction = getTransactionBySessionId(sessionId);

      if (!transaction) {
        throw new ApiError(404, "Transaction not found");
      }

      res.setHeader('Content-Type', 'application/json');
      res.json({
        status: transaction.status,
        transaction,
      });
    } catch (err) {
      next(err);
    }
  }
);

app.get(
  "/crypto-status/:transactionId",
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { transactionId } = req.params;

      if (!transactionId || typeof transactionId !== "string") {
        throw new ApiError(400, "Missing transaction ID");
      }

      const transaction = getCryptoTransactionByTransacctionId(transactionId);

      if (!transaction) {
        throw new ApiError(404, "Crypto transaction not found");
      }

      res.setHeader('Content-Type', 'application/json');
      res.json({
        status: transaction.status,
        transaction,
      });
    } catch (err) {
      next(err);
    }
  }
);

app.get("/transactions", authenticateToken, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = getAllTransaction();
    res.setHeader('Content-Type', 'application/json');
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});

app.get("/crypto-transactions", authenticateToken, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = getAllCryptoTransactions();
    res.setHeader('Content-Type', 'application/json');
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

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
