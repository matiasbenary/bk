import { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { createProduct, getAllProducts } from "../database";
import { ApiError } from "../middleware/errorHandler";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const HOTPAY_API_URL = "https://dev.herewallet.app/partners/merchant_item";
const HOTPAY_AUTH_TOKEN = process.env.HOTPAY_AUTH_TOKEN || "";
const HOTPAY_MERCHANT_ID = process.env.HOTPAY_MERCHANT_ID || "";
const HOTPAY_WEBHOOK_URL = process.env.HOTPAY_WEBHOOK_URL || "";

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, price, image_url } = req.body;

    if (!name || !price) {
      throw new ApiError(400, "Missing required fields: name, price");
    }

    const stripeProduct = await stripe.products.create({
      name,
      description: description || undefined,
      images: image_url ? [image_url] : undefined,
      default_price_data: {
        currency: "usd",
        unit_amount: price,
      },
    });

    let hotpayItemId: string | undefined;
    if (HOTPAY_AUTH_TOKEN && HOTPAY_MERCHANT_ID) {
      const hotpayResponse = await fetch(HOTPAY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: HOTPAY_AUTH_TOKEN,
        },
        body: JSON.stringify({
          merchant_id: HOTPAY_MERCHANT_ID,
          memo: name,
          amount: price / 100,
          header: name,
          description: description || "",
          token: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",// Always use USDC
          redirect_url: "",
          icon: image_url || "",
          webhook_url: HOTPAY_WEBHOOK_URL,
        }),
      });

      if (hotpayResponse.ok) {
        const hotpayData = await hotpayResponse.json();
        hotpayItemId = hotpayData.item_id;
      }
    }

    const result = createProduct({
      name,
      description,
      price,
      image_url,
      stripe_product_id: stripeProduct.id,
      hotpay_item_id: hotpayItemId,
    });

    res.json({
      id: result.lastInsertRowid,
      name,
      description,
      price,
      image_url,
      stripe_product_id: stripeProduct.id,
      hotpay_item_id: hotpayItemId,
    });
  } catch (err) {
    next(err);
  }
};

export const list = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const products = getAllProducts();
    res.json({ products });
  } catch (err) {
    next(err);
  }
};
