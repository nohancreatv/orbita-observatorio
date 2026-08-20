import serverless from "serverless-http";
import { createApiApp } from "../../server/_core/app";

/**
 * Adaptador de produção para as rotas Express/tRPC. O rewrite em netlify.toml
 * mantém os endpoints públicos em /api/*, sem expor o caminho interno da função.
 */
export const handler = serverless(createApiApp());
