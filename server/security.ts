import type { RequestHandler } from "express";

/** Cabeçalhos aplicados em produção; mantidos fora do modo de desenvolvimento para não bloquear o Vite. */
export const productionSecurityHeaders: RequestHandler = (req, res, next) => {
  if (process.env.NODE_ENV !== "production") return next();

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' https://pagead2.googlesyndication.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://*.nasa.gov https://eoimages.gsfc.nasa.gov https://staticmap.openstreetmap.de https://server.arcgisonline.com https://maps.googleapis.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://d36hbw14aib5lz.cloudfront.net",
    "connect-src 'self' https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com",
    "frame-src https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com",
    "upgrade-insecure-requests",
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("Permissions-Policy", "geolocation=(self), camera=(), microphone=(), payment=(), usb=()");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
};

type Bucket = { count: number; resetAt: number };
const requestBuckets = new Map<string, Bucket>();

/** Limite simples em memória: reduz abuso de rotas públicas sem registrar coordenadas ou perfis de visitantes. */
export function isRateLimited(identity: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const bucket = requestBuckets.get(identity);
  if (!bucket || bucket.resetAt <= now) {
    requestBuckets.set(identity, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}
