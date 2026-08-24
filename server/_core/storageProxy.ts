import type { Express } from "express";
import { ENV } from "./env";

export function isSafeStorageKey(key: string) {
  return key.length > 0
    && key.length <= 512
    && /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(key)
    && !key.includes("\\")
    && !key.split("/").some(segment => segment === "." || segment === "..");
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res, next) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key || !isSafeStorageKey(key)) {
      res.status(400).send("Invalid storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      // Nenhum storage remoto configurado — permite que o Vite ou o express.static sirvam de client/public/manus-storage/
      return next();
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
        signal: AbortSignal.timeout(8_000),
      });

      if (!forgeResp.ok) {
        console.error(`[StorageProxy] forge error: ${forgeResp.status}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
