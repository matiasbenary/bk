import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import {
  createHotTransaction,
  getAllHotTransactions,
  getHotTransactionByTransactionId,
  updateHotTransactionStatus,
  getProductById,
} from "../database";
import { ApiError } from "../middleware/errorHandler";

const HOTPAY_PAYMENT_URL = "https://pay.hot-labs.org/payment";

const webHook = async (req: Request, res: Response, next: NextFunction) => {
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

    updateHotTransactionStatus(transactionId, dbStatus, near_trx);

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
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

    if (!product.hotpay_item_id) {
      throw new ApiError(400, "Product does not have HotPay configured");
    }

    const transactionId = randomUUID();
    createHotTransaction({
      email,
      transaction_id: transactionId,
      amount_cents: product.price,
      product_name: product.name,
    });

    res.json({
      paymentUrl: `${HOTPAY_PAYMENT_URL}?item_id=${product.hotpay_item_id}&transaction_id=${transactionId}`,
      sessionId: transactionId,
    });
  } catch (err) {
    next(err);
  }
};

const getStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId || typeof transactionId !== "string") {
      throw new ApiError(400, "Missing transaction ID");
    }

    const transaction = getHotTransactionByTransactionId(transactionId);

    if (!transaction) {
      throw new ApiError(404, "Crypto transaction not found");
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
    const transactions = getAllHotTransactions();
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