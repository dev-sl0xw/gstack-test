import { beforeAll, describe, expect, test } from "bun:test";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "../db/client.ts";
import { createApp } from "../app.ts";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
});

describe("auth routes", () => {
  test("signup → login → logout flow", async () => {
    const app = createApp();

    const signupRes = await app.request("/auth/signup", {
      method: "POST",
      body: new URLSearchParams({
        username: `u${Date.now().toString(36)}`,
        email: `e${Date.now()}@ex.com`,
        password: "password123",
      }),
    });
    expect(signupRes.status).toBe(302);
    const cookie = signupRes.headers.get("set-cookie")!;
    expect(cookie).toContain("sid=");
    expect(cookie.toLowerCase()).toContain("httponly");

    const logoutRes = await app.request("/auth/logout", {
      method: "POST",
      headers: { cookie: cookie.split(";")[0] },
    });
    expect(logoutRes.status).toBe(302);
  });

  test("signup with bad email returns 400", async () => {
    const app = createApp();
    const res = await app.request("/auth/signup", {
      method: "POST",
      body: new URLSearchParams({
        username: "valid",
        email: "not-an-email",
        password: "password123",
      }),
    });
    expect(res.status).toBe(400);
  });
});
