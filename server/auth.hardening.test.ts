import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthenticatedContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "internal-open-id",
      email: "visitor@example.com",
      name: "Visitante",
      loginMethod: "oauth",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("superfície de autenticação", () => {
  it("retorna somente o perfil mínimo necessário ao cliente", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    const profile = await caller.auth.me();

    expect(profile).toEqual({ name: "Visitante", role: "user" });
    expect(profile).not.toHaveProperty("email");
    expect(profile).not.toHaveProperty("openId");
    expect(profile).not.toHaveProperty("loginMethod");
  });

  it("não mantém token ou perfil autenticado em armazenamento acessível a scripts", () => {
    const clientEntry = readFileSync(new URL("../client/src/main.tsx", import.meta.url), "utf8");
    const authHook = readFileSync(new URL("../client/src/_core/hooks/useAuth.ts", import.meta.url), "utf8");
    const authSdk = readFileSync(new URL("./_core/sdk.ts", import.meta.url), "utf8");

    expect(clientEntry).not.toContain("sessionStorage");
    expect(clientEntry).not.toContain("Authorization: `Bearer");
    expect(authHook).not.toContain("localStorage.setItem");
    expect(authSdk).not.toContain("req.headers.authorization");
  });
});
