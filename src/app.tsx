import { Hono } from "hono";
import { attachAuth, type AuthVars } from "./middleware/auth.ts";
import { auth } from "./routes/auth.tsx";
import { Landing } from "./views/landing.tsx";

export function createApp() {
  const app = new Hono<{ Variables: AuthVars }>();
  app.use("*", attachAuth);
  app.get("/", (c) => c.html(<Landing user={c.get("user")} />));
  app.get("/healthz", (c) => c.text("ok"));
  app.route("/auth", auth);
  return app;
}
