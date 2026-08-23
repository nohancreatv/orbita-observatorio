import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthenticatedContext(): TrpcContext {
  return {
    user: {
      openId: "internal-open-id",
      name: "Visitante",
      email: "visitor@example.com",
      role: "user",
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
  });

  it("não mantém token ou perfil autenticado em armazenamento acessível a scripts", () => {
    const clientEntry = readFileSync(new URL("../client/src/main.tsx", import.meta.url), "utf8");

    expect(clientEntry).not.toContain("sessionStorage");
    expect(clientEntry).not.toContain("Authorization: `Bearer");
  });
});
