import { Hono } from "hono";
import { attachAuth, type AuthVars } from "./middleware/auth.ts";

export function createApp() {
  const app = new Hono<{ Variables: AuthVars }>();
  app.use("*", attachAuth);
  app.get("/healthz", (c) => c.text("ok"));
  return app;
}
