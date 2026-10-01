import { type NextFunction, type Request, type Response } from "express";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "../lib/supabase";

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

/**
 * Verifies the Supabase access token the frontend sends as a bearer token,
 * and attaches the authenticated user to the request.
 */
export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Sign in to continue." });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Your session has expired. Sign in again." });
      return;
    }
    req.user = data.user;
    next();
  } catch (err) {
    console.error("[requireUser] token verification failed:", err);
    res.status(401).json({ error: "UNAUTHORIZED", message: "Could not verify your session." });
  }
}
