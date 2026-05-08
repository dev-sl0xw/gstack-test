import type { Context, Next } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { users } from "../db/schema.ts";
import { loadSession } from "../lib/sessions.ts";
import { getSessionCookie } from "../lib/cookies.ts";

export type AuthVars = {
  user: { id: string; username: string; email: string } | null;
  sessionId: string | null;
};

export async function attachAuth(c: Context, next: Next) {
  const sid = getSessionCookie(c);
  if (!sid) {
    c.set("user", null);
    c.set("sessionId", null);
    return next();
  }
  const session = await loadSession(sid);
  if (!session) {
    c.set("user", null);
    c.set("sessionId", null);
    return next();
  }
  const [user] = await db.select({
    id: users.id, username: users.username, email: users.email,
  }).from(users).where(eq(users.id, session.userId));
  c.set("user", user ?? null);
  c.set("sessionId", session.id);
  return next();
}

export async function requireAuth(c: Context, next: Next) {
  if (!c.get("user")) return c.redirect("/", 302);
  return next();
}
