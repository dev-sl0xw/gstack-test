import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { users } from "../db/schema.ts";
import { signupSchema, loginSchema } from "../lib/validate.ts";
import { hashPassword, verifyPassword } from "../lib/passwords.ts";
import { ulid } from "../lib/ids.ts";
import { now } from "../lib/time.ts";
import { createSession, destroySession } from "../lib/sessions.ts";
import { setSessionCookie, getSessionCookie, clearSessionCookie } from "../lib/cookies.ts";
import { SignupForm, LoginForm } from "../views/auth.tsx";
import type { AuthVars } from "../middleware/auth.ts";

export const auth = new Hono<{ Variables: AuthVars }>();

auth.get("/signup", (c) => c.html(<SignupForm />));
auth.get("/login", (c) => c.html(<LoginForm />));

auth.post("/signup", async (c) => {
  const form = await c.req.parseBody();
  const parsed = signupSchema.safeParse(form);
  if (!parsed.success) {
    return c.html(<SignupForm error="입력값을 확인해주세요" />, 400);
  }
  const { username, email, password } = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, email));
  if (existing) return c.html(<SignupForm error="가입할 수 없습니다" />, 400);

  const id = ulid();
  await db.insert(users).values({
    id,
    username,
    email,
    passwordHash: await hashPassword(password),
    createdAt: now(),
  });

  const sid = await createSession(id);
  setSessionCookie(c, sid);
  return c.redirect("/app", 302);
});

auth.post("/login", async (c) => {
  const form = await c.req.parseBody();
  const parsed = loginSchema.safeParse(form);
  if (!parsed.success) return c.html(<LoginForm error="invalid credentials" />, 400);

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  if (!user) return c.html(<LoginForm error="invalid credentials" />, 400);

  const ok = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!ok) return c.html(<LoginForm error="invalid credentials" />, 400);

  const sid = await createSession(user.id);
  setSessionCookie(c, sid);
  return c.redirect("/app", 302);
});

auth.post("/logout", async (c) => {
  const sid = getSessionCookie(c);
  if (sid) await destroySession(sid);
  clearSessionCookie(c);
  return c.redirect("/", 302);
});
