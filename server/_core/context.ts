/**
 * tRPC context factory.
 *
 * Extracts the session from either:
 * 1. The `app_session_id` cookie (normal browser flow), or
 * 2. An `Authorization: Bearer <token>` header (fallback for iframes / Safari ITP).
 *
 * The JWT is verified with the shared secret. If it is missing or invalid the
 * user is simply `null` — protected procedures will reject the request.
 *
 * NO external agent platform (Manus, Freebuff, etc.) is required.
 */
import type { Request, Response } from "express";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "../../shared/const";
import { ENV } from "./env";

type SessionPayload = {
  sub: string;
  name?: string;
  email?: string;
  role?: string;
};

export type TrpcContext = {
  req: Request;
  res: Response;
  user: {
    openId: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
};

function extractToken(req: Request): string | null {
  // 1. Cookie
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.split(/;\s*/).find((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (match) {
      const value = match.split("=").slice(1).join("=");
      if (value) return value;
    }
  }

  // 2. Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

export async function createContext({ req, res }: { req: Request; res: Response }): Promise<TrpcContext> {
  const token = extractToken(req);

  if (!token || !ENV.cookieSecret) {
    return { req, res, user: null };
  }

  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secret);
    const p = payload as unknown as SessionPayload;

    return {
      req,
      res,
      user: {
        openId: p.sub,
        name: p.name,
        email: p.email,
        role: p.role,
      },
    };
  } catch {
    return { req, res, user: null };
  }
}
