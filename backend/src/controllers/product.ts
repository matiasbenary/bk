import { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { createProduct, getAllProducts } from "../database";
import { ApiError } from "../middleware/errorHandler";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const HOT_PAY_API_URL = "https://dev.herewallet.app/partners/merchant_item";
const HOT_PAY_AUTH_TOKEN = process.env.HOT_PAY_AUTH_TOKEN || "";
const HOT_PAY_MERCHANT_ID = process.env.HOT_PAY_MERCHANT_ID || "";
const HOT_PAY_WEBHOOK_URL = process.env.HOT_PAY_WEBHOOK_URL || "";

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

    let hotPayItemId: string | undefined;
    if (HOT_PAY_AUTH_TOKEN && HOT_PAY_MERCHANT_ID) {
      const hotPayResponse = await fetch(HOT_PAY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: HOT_PAY_AUTH_TOKEN,
        },
        body: JSON.stringify({
          merchant_id: HOT_PAY_MERCHANT_ID,
          memo: name,
          amount: price / 100,
          header: name,
          description: description || "",
          token: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",// Always use USDC
          redirect_url: "",
          icon: image_url || "",
          webhook_url: HOT_PAY_WEBHOOK_URL,
        }),
      });

      if (hotPayResponse.ok) {
        const hotPayData = await hotPayResponse.json();
        hotPayItemId = hotPayData.item_id;
      }
    }

    const result = createProduct({
      name,
      description,
      price,
      image_url,
      stripe_product_id: stripeProduct.id,
      hot_pay_item_id: hotPayItemId,
    });

    res.json({
      id: result.lastInsertRowid,
      name,
      description,
      price,
      image_url,
      stripe_product_id: stripeProduct.id,
      hot_pay_item_id: hotPayItemId,
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
