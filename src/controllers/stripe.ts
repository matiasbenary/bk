import { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import {
  updateTransactionStatus,
  createTransaction,
  getTransactionBySessionId,
  getAllTransaction,
  getProductById,
} from "../database";
import { ApiError } from "../middleware/errorHandler";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const webHook = (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;

  if (STRIPE_WEBHOOK_SECRET) {
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
};

const createSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, productId } = req.body;

    if (!email || !productId) {
      throw new ApiError(400, "Missing required fields: email, productId");
    }

    const product = getProductById(productId);
    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    if (!product.stripe_product_id) {
      throw new ApiError(400, "Product does not have Stripe configured");
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product: product.stripe_product_id,
            unit_amount: product.price,
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
      amount_cents: product.price,
      product_name: product.name,
    });

    res.json({
      sessionUrl: session.url,
      sessionId: session.id,
    });
  } catch (err) {
    next(err);
  }
};

const getStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || typeof sessionId !== "string") {
      throw new ApiError(400, "Missing session ID");
    }

    const transaction = getTransactionBySessionId(sessionId);

    if (!transaction) {
      throw new ApiError(404, "Transaction not found");
    }

    res.json({
      status: transaction.status,
      transaction,
    });
  } catch (err) {
    next(err);
  }
};

const getTransactions = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = getAllTransaction();
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
};

export default {
  webHook,
  createSession,
  getStatus,
  getTransactions
};
