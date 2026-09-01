import { createClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";
import WebSocket from "ws";

// Supabase eagerly constructs its Realtime client during createClient().
// Replit's API workflow runs on Node 20, which does not expose a native
// WebSocket global. Realtime is not used by this API, but it still needs a
// compatible constructor to let the auth client initialize.
const runtime = globalThis as typeof globalThis & {
  WebSocket?: any;
};
if (!runtime.WebSocket) {
  runtime.WebSocket = WebSocket as any;
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set. " +
      "This app requires a real Supabase project to verify logins against — " +
      "it never falls back to allowing unauthenticated access.",
  );
}

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "UNAUTHENTICATED", message: "Login required." });
    return;
  }

  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "UNAUTHENTICATED", message: "Session expired or invalid — please log in again." });
    return;
  }

  const portfolioOwnerId = process.env.PORTFOLIO_OWNER_USER_ID?.trim();
  if (!portfolioOwnerId) {
    console.error("[auth] PORTFOLIO_OWNER_USER_ID is not configured");
    res.status(503).json({
      error: "AUTH_CONFIGURATION_REQUIRED",
      message: "Portfolio ownership is not configured on the server.",
    });
    return;
  }

  if (data.user.id !== portfolioOwnerId) {
    res.status(403).json({
      error: "FORBIDDEN",
      message: "This portfolio is not available to this account.",
    });
    return;
  }

  (req as Request & { userId?: string }).userId = data.user.id;
  next();
}
