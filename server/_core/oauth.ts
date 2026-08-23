/**
 * OAuth routes.
 *
 * The observatory does not require user authentication for its core features.
 * This module registers a stub callback that returns a clear message if any
 * OAuth flow is triggered, without depending on external agent platforms.
 */
import type { Express, Request, Response } from "express";

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.status(404).json({
      error: "OAuth not configured",
      message: "Este observatório funciona sem autenticação. Todas as funcionalidades estão disponíveis publicamente.",
    });
  });
}
