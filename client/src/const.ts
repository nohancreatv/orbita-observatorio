export { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";

/**
 * Placeholder for future authentication login flow.
 * The Manus OAuth redirect has been removed — the app is agent-independent.
 * When a login provider is configured, implement the redirect here.
 */
export const startLogin = () => {
  // No external auth portal configured — the observatory works without login.
  console.info("[orbita] Authentication is not configured. Skipping login.");
};
