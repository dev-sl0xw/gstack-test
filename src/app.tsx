import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { attachAuth, type AuthVars } from "./middleware/auth.ts";
import { auth } from "./routes/auth.tsx";
import { appRoutes } from "./routes/app.tsx";
import { pub } from "./routes/public.tsx";
import { Landing } from "./views/landing.tsx";
import { NotFound } from "./views/not-found.tsx";

export function createApp() {
  const app = new Hono<{ Variables: AuthVars }>();
  app.use("/styles.css", serveStatic({ path: "./public/styles.css" }));
  app.use("/htmx.min.js", serveStatic({ path: "./public/htmx.min.js" }));
  app.use("*", attachAuth);
  app.get("/", (c) => c.html(<Landing user={c.get("user")} />));
  app.get("/healthz", (c) => c.text("ok"));
  app.route("/auth", auth);
  app.route("/app", appRoutes);
  app.route("/", pub);
  app.notFound((c) => c.html(<NotFound />, 404));
  return app;
}
