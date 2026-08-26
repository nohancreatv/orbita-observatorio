export { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";

/**
 * Placeholder for future authentication login flow.
 * No external OAuth redirect is configured — the app is independent of login
 * providers. When a provider is configured, implement the redirect here.
 */
export const startLogin = () => {
  // No external auth portal configured — the observatory works without login.
  console.info("[orbita] Authentication is not configured. Skipping login.");
};
