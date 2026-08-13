import { type Request, type Response, type NextFunction } from "express";
import { authService } from "../services/authService";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Missing or malformed Authorization header." });
    return;
  }

  const token = header.slice(7);
  try {
    req.userId = authService.verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Access token is invalid or expired." });
  }
}
