import { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { createOrUpdateUser, getUserByGoogleId } from "../database";
import { ApiError } from "../middleware/errorHandler";
import { JWTPayload } from "../types";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export const googleAuth = (_req: Request, res: Response) => {
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "profile", "email"],
    state: Math.random().toString(36).substring(7),
  });
  res.redirect(authorizeUrl);
};

export const googleCallback = async (req: Request, res: Response, next: NextFunction) => {
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
};

export const getMe = (req: Request, res: Response) => {
  res.json({ user: req.user });
};
