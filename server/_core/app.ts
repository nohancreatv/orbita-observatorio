import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { productionSecurityHeaders } from "../security";
import { createContext } from "./context";
import { registerOAuthRoutes } from "./oauth";

/**
 * Cria o núcleo HTTP compartilhado pelo servidor local e pela função Netlify.
 * Arquivos estáticos e Vite pertencem ao runtime de cada plataforma, portanto
 * não são registrados aqui.
 */
export function createApiApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(productionSecurityHeaders);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    next();
  });
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );
  return app;
}
