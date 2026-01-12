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
} from "./database";
import { errorHandler, ApiError } from "./middleware/errorHandler";
import { authenticateToken } from "./middleware/auth";
import { JWTPayload } from "./types";

const app = express();
const PORT = process.env.PORT || 3000;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

app.use(
  cors({
    origin: FRONTEND_URL,
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

    const { type, item_id, status, memo, amount, near_trx } = req.body;
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

app.post("/auth/logout", (_req: Request, res: Response) => {
  res.json({ message: "Logged out successfully" });
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


      const response = await fetch("https://dev.herewallet.app/partners/merchant_item", {
        method: "POST",
        headers: {
          "accept": "*/*",
          "authorization": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkb21haW4iOiJwYXkuaG90LWxhYnMub3JnIiwia2V5X2lkIjoxNCwidzNfdXNlcl9pZCI6NTQxMTMsInR5cGUiOiJ3aWJlMyJ9._U14S2VWNiRFMv93__T32HeOPHjFUNb9TDhi-o3p4WY",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          merchant_id: "maguila.near",
          memo: productName,
          header: productName,
          description: "",
          token: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
          redirect_url: "",
          icon: "",
          webhook_url: `http://localhost:3000/crypto-webhook`
        })
      });

      const data = await response.json();

      createCryptoTransaction({
        email,
        item_id: data.item_id,
        amount_cents: amount,
        product_name: productName,
      });

      res.json({
        paymentUrl: `https://pay.hot-labs.org/payment?item_id=${data.item_id}`,
        sessionId: data.id,
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

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
