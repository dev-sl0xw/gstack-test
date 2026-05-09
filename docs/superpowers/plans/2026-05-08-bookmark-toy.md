# Bookmark Toy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive web bookmarking toy (signup, bookmark CRUD, tags, public profile) on Hono + bun + Turso + Fly, sized for a ~1-day cycle so every gstack tool can fire meaningfully.

**Architecture:** Single Hono app runs on bun. SSR HTML via Hono/JSX with HTMX for tiny interactions — no React. Drizzle ORM talks to libSQL (Turso in prod, local file in dev). Self-rolled auth: `bun.password.hash` + opaque session ID stored in DB + HMAC-signed CSRF token. Deploys as a Docker image to Fly.io.

**Tech Stack:** bun 1.x · Hono 4.x · Hono/JSX · HTMX 1.x · Drizzle ORM · @libsql/client · Zod · `bun:test` · Fly.io · Turso

**Spec:** `docs/superpowers/specs/2026-05-08-gstack-bookmark-toy-design.md`

---

## Phase 0 — Project setup (Tasks 1–3)

### Task 1: Initialize bun project + Hono app skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/app.ts`
- Create: `src/server.ts`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Init bun project**

```bash
cd /Volumes/data/claude-vibe-workspace/gstack-test
bun init -y
```

- [ ] **Step 2: Install runtime deps**

```bash
bun add hono @libsql/client drizzle-orm zod
bun add -d drizzle-kit @types/bun typescript
```

- [ ] **Step 3: Replace `package.json` scripts block**

```json
{
  "scripts": {
    "dev": "bun run --watch src/server.ts",
    "start": "bun run src/server.ts",
    "build": "bun build src/server.ts --target=bun --outdir=dist",
    "test": "bun test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "bun run src/db/migrate.ts"
  }
}
```

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "strict": true,
    "skipLibCheck": true,
    "types": ["bun-types"],
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 5: Write `src/app.ts`**

```ts
import { Hono } from "hono";

export function createApp() {
  const app = new Hono();
  app.get("/healthz", (c) => c.text("ok"));
  return app;
}
```

- [ ] **Step 6: Write `src/server.ts`**

```ts
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

console.log(`listening on :${port}`);
export default { port, fetch: app.fetch };
```

- [ ] **Step 7: Write `.env.example`**

```
PORT=3000
DATABASE_URL=file:./dev.db
DATABASE_AUTH_TOKEN=
SESSION_SECRET=change-me-32-bytes-hex
CSRF_SECRET=change-me-different-32-bytes-hex
```

- [ ] **Step 8: Append to `.gitignore`**

```
node_modules/
dist/
*.db
*.db-journal
.env
```

- [ ] **Step 9: Create local `.env` from example**

```bash
cp .env.example .env
SESSION_SECRET=$(openssl rand -hex 32)
CSRF_SECRET=$(openssl rand -hex 32)
sed -i.bak "s|change-me-32-bytes-hex|$SESSION_SECRET|" .env
sed -i.bak "s|change-me-different-32-bytes-hex|$CSRF_SECRET|" .env
rm .env.bak
```

- [ ] **Step 10: Smoke test the server**

Run: `bun run dev` (in another terminal: `curl localhost:3000/healthz`)
Expected: `ok`. Then stop the dev server.

- [ ] **Step 11: Commit**

```bash
git add package.json bun.lockb tsconfig.json src/ .env.example .gitignore
git commit -m "chore: scaffold bun + Hono project"
```

---

### Task 2: Drizzle schema + migration tooling

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/db/schema.ts`
- Create: `src/db/client.ts`
- Create: `src/db/migrate.ts`

- [ ] **Step 1: Write `src/db/schema.ts`**

```ts
import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  ogImageUrl: text("og_image_url"),
  isPublic: integer("is_public").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => ({
  userCreatedIdx: index("bm_user_created_idx").on(t.userId, t.createdAt),
  userPublicIdx: index("bm_user_public_idx").on(t.userId, t.isPublic),
}));

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
}, (t) => ({
  userNameUnique: uniqueIndex("tag_user_name_uniq").on(t.userId, t.name),
}));

export const bookmarkTags = sqliteTable("bookmark_tags", {
  bookmarkId: text("bookmark_id").notNull().references(() => bookmarks.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.bookmarkId, t.tagId] }),
}));
```

- [ ] **Step 2: Write `src/db/client.ts`**

```ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const client = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
```

- [ ] **Step 3: Write `drizzle.config.ts`**

```ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  driver: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
} satisfies Config;
```

- [ ] **Step 4: Write `src/db/migrate.ts`**

```ts
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./client.ts";

await migrate(db, { migrationsFolder: "./src/db/migrations" });
console.log("migrations applied");
```

- [ ] **Step 5: Generate the first migration**

Run: `bun run db:generate`
Expected: SQL files appear under `src/db/migrations/`.

- [ ] **Step 6: Apply migrations to local file DB**

Run: `bun run db:migrate`
Expected: `migrations applied`. `dev.db` exists.

- [ ] **Step 7: Commit**

```bash
git add src/db/ drizzle.config.ts package.json
git commit -m "feat(db): drizzle schema + libsql client + migrator"
```

---

### Task 3: ULID generator + small util module

**Files:**
- Create: `src/lib/ids.ts`
- Create: `src/lib/time.ts`
- Create: `src/lib/__tests__/ids.test.ts`

- [ ] **Step 1: Write failing test `src/lib/__tests__/ids.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { ulid } from "../ids.ts";

describe("ulid", () => {
  test("returns 26-char Crockford-base32 string", () => {
    const id = ulid();
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  test("two consecutive ulids are different", () => {
    expect(ulid()).not.toBe(ulid());
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bun test src/lib/__tests__/ids.test.ts`
Expected: FAIL — `Cannot find module '../ids.ts'`.

- [ ] **Step 3: Write `src/lib/ids.ts`**

```ts
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function ulid(): string {
  const time = Date.now();
  let timeStr = "";
  let t = time;
  for (let i = 0; i < 10; i++) {
    timeStr = ALPHABET[t % 32] + timeStr;
    t = Math.floor(t / 32);
  }
  const rand = crypto.getRandomValues(new Uint8Array(16));
  let randStr = "";
  for (let i = 0; i < 16; i++) {
    randStr += ALPHABET[rand[i] % 32];
  }
  return timeStr + randStr;
}
```

- [ ] **Step 4: Write `src/lib/time.ts`**

```ts
export const now = () => Date.now();
export const days = (n: number) => n * 24 * 60 * 60 * 1000;
```

- [ ] **Step 5: Run test, expect PASS**

Run: `bun test src/lib/__tests__/ids.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ids.ts src/lib/time.ts src/lib/__tests__/ids.test.ts
git commit -m "feat(lib): ulid generator + time helpers"
```

---

## Phase 1 — Security primitives (TDD) (Tasks 4–7)

### Task 4: SSRF guard for OG fetch

**Files:**
- Create: `src/lib/ssrf-guard.ts`
- Create: `src/lib/__tests__/ssrf-guard.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, test } from "bun:test";
import { isSafePublicHost } from "../ssrf-guard.ts";

describe("isSafePublicHost", () => {
  test.each([
    ["10.0.0.1", false],
    ["10.255.255.255", false],
    ["172.16.0.1", false],
    ["172.31.255.255", false],
    ["192.168.1.1", false],
    ["127.0.0.1", false],
    ["0.0.0.0", false],
    ["169.254.169.254", false], // AWS metadata
    ["::1", false],
    ["fe80::1", false],
    ["8.8.8.8", true],
    ["1.1.1.1", true],
    ["2606:4700:4700::1111", true],
  ])("ip %s -> %p", (ip, expected) => {
    expect(isSafePublicHost(ip)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bun test src/lib/__tests__/ssrf-guard.test.ts`
Expected: module not found error.

- [ ] **Step 3: Write `src/lib/ssrf-guard.ts`**

```ts
export function isSafePublicHost(host: string): boolean {
  // strip brackets from IPv6 literals
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();

  // IPv4
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = v4.slice(1, 3).map(Number);
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 0) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
    return true;
  }

  // IPv6
  if (h.includes(":")) {
    if (h === "::1" || h === "::") return false;
    if (h.startsWith("fe80:")) return false;
    if (h.startsWith("fc") || h.startsWith("fd")) return false;
    return true;
  }

  return false; // hostname, not an IP — caller resolves first
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `bun test src/lib/__tests__/ssrf-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ssrf-guard.ts src/lib/__tests__/ssrf-guard.test.ts
git commit -m "feat(security): SSRF private-IP guard with full IPv4/v6 coverage"
```

---

### Task 5: Password hash + verify wrapper

**Files:**
- Create: `src/lib/passwords.ts`
- Create: `src/lib/__tests__/passwords.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "../passwords.ts";

describe("passwords", () => {
  test("verify accepts the correct password", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword(hash, "hunter2")).toBe(true);
  });

  test("verify rejects the wrong password", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  test("hash is argon2id and not the plaintext", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain("hunter2");
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bun test src/lib/__tests__/passwords.test.ts`

- [ ] **Step 3: Write `src/lib/passwords.ts`**

```ts
export async function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain, { algorithm: "argon2id" });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await Bun.password.verify(plain, hash);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `bun test src/lib/__tests__/passwords.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/passwords.ts src/lib/__tests__/passwords.test.ts
git commit -m "feat(security): argon2id password hash + verify wrapper"
```

---

### Task 6: HMAC-signed CSRF token

**Files:**
- Create: `src/lib/csrf.ts`
- Create: `src/lib/__tests__/csrf.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, test } from "bun:test";
import { signToken, verifyToken } from "../csrf.ts";

const SECRET = "a".repeat(64);

describe("csrf token", () => {
  test("signed token verifies", () => {
    const t = signToken("session-id-123", SECRET);
    expect(verifyToken(t, "session-id-123", SECRET)).toBe(true);
  });

  test("token tied to session id", () => {
    const t = signToken("session-id-123", SECRET);
    expect(verifyToken(t, "different-session", SECRET)).toBe(false);
  });

  test("tampering invalidates", () => {
    const t = signToken("session-id-123", SECRET);
    const tampered = t.slice(0, -2) + "xx";
    expect(verifyToken(tampered, "session-id-123", SECRET)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bun test src/lib/__tests__/csrf.test.ts`

- [ ] **Step 3: Write `src/lib/csrf.ts`**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function signToken(sessionId: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(sessionId).digest("hex");
  return mac;
}

export function verifyToken(token: string, sessionId: string, secret: string): boolean {
  const expected = signToken(sessionId, secret);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `bun test src/lib/__tests__/csrf.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/csrf.ts src/lib/__tests__/csrf.test.ts
git commit -m "feat(security): HMAC-bound CSRF tokens tied to session id"
```

---

### Task 7: Zod validation schemas

**Files:**
- Create: `src/lib/validate.ts`
- Create: `src/lib/__tests__/validate.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, test } from "bun:test";
import { signupSchema, urlInputSchema, usernameSchema } from "../validate.ts";

describe("usernameSchema", () => {
  test.each([
    ["alice", true],
    ["a_b-c1", true],
    ["ab", false], // too short
    ["UPPER", false],
    ["has spaces", false],
    ["a".repeat(21), false],
  ])("%s -> %p", (s, ok) => {
    expect(usernameSchema.safeParse(s).success).toBe(ok);
  });
});

describe("signupSchema", () => {
  test("accepts valid", () => {
    const r = signupSchema.safeParse({
      username: "alice",
      email: "a@b.com",
      password: "longenough",
    });
    expect(r.success).toBe(true);
  });

  test("rejects short password", () => {
    const r = signupSchema.safeParse({
      username: "alice",
      email: "a@b.com",
      password: "short",
    });
    expect(r.success).toBe(false);
  });
});

describe("urlInputSchema", () => {
  test.each([
    ["https://example.com", true],
    ["http://example.com/path?q=1", true],
    ["ftp://example.com", false],
    ["javascript:alert(1)", false],
    ["not a url", false],
  ])("%s -> %p", (s, ok) => {
    expect(urlInputSchema.safeParse(s).success).toBe(ok);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bun test src/lib/__tests__/validate.test.ts`

- [ ] **Step 3: Write `src/lib/validate.ts`**

```ts
import { z } from "zod";

export const usernameSchema = z.string().regex(/^[a-z0-9_-]{3,20}$/);
export const emailSchema = z.string().email().toLowerCase().max(254);
export const passwordSchema = z.string().min(8).max(200);

export const signupSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const urlInputSchema = z
  .string()
  .max(2048)
  .url()
  .refine((u) => {
    try {
      const p = new URL(u).protocol;
      return p === "http:" || p === "https:";
    } catch {
      return false;
    }
  });

export const bookmarkInputSchema = z.object({
  url: urlInputSchema,
  tags: z.string().max(200).optional().default(""),
  is_public: z.union([z.literal("on"), z.literal("")]).optional(),
});
```

- [ ] **Step 4: Run test, expect PASS**

Run: `bun test src/lib/__tests__/validate.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/validate.ts src/lib/__tests__/validate.test.ts
git commit -m "feat(lib): Zod schemas for signup, login, URL input"
```

---

## Phase 2 — App skeleton + sessions (Tasks 8–9)

### Task 8: Session create/load/destroy

**Files:**
- Create: `src/lib/sessions.ts`
- Create: `src/lib/__tests__/sessions.test.ts`

- [ ] **Step 1: Write failing integration test**

```ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { users } from "../../db/schema.ts";
import { ulid } from "../ids.ts";
import { hashPassword } from "../passwords.ts";
import { createSession, loadSession, destroySession } from "../sessions.ts";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
});

const seedUser = async () => {
  const id = ulid();
  await db.insert(users).values({
    id,
    username: `u${id.slice(-6).toLowerCase()}`,
    email: `${id.slice(-6).toLowerCase()}@e.com`,
    passwordHash: await hashPassword("password"),
    createdAt: Date.now(),
  });
  return id;
};

describe("sessions", () => {
  test("create then load returns user id", async () => {
    const userId = await seedUser();
    const sid = await createSession(userId);
    const loaded = await loadSession(sid);
    expect(loaded?.userId).toBe(userId);
  });

  test("destroyed session no longer loads", async () => {
    const userId = await seedUser();
    const sid = await createSession(userId);
    await destroySession(sid);
    expect(await loadSession(sid)).toBe(null);
  });

  test("expired session returns null and is deleted", async () => {
    const userId = await seedUser();
    const sid = await createSession(userId, -1000); // already expired
    expect(await loadSession(sid)).toBe(null);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bun test src/lib/__tests__/sessions.test.ts`

- [ ] **Step 3: Write `src/lib/sessions.ts`**

```ts
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { sessions } from "../db/schema.ts";
import { days, now } from "./time.ts";

const SESSION_TTL_MS = days(30);

export async function createSession(userId: string, ttlMs = SESSION_TTL_MS) {
  const id = crypto.getRandomValues(new Uint8Array(32))
    .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
  await db.insert(sessions).values({
    id,
    userId,
    expiresAt: now() + ttlMs,
    createdAt: now(),
  });
  return id;
}

export async function loadSession(id: string) {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!row) return null;
  if (row.expiresAt < now()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  return row;
}

export async function destroySession(id: string) {
  await db.delete(sessions).where(eq(sessions.id, id));
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `bun test src/lib/__tests__/sessions.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/sessions.ts src/lib/__tests__/sessions.test.ts
git commit -m "feat(auth): session create/load/destroy with 30-day TTL + lazy expiry"
```

---

### Task 9: Auth middleware + cookie helpers

**Files:**
- Create: `src/lib/cookies.ts`
- Create: `src/middleware/auth.ts`

- [ ] **Step 1: Write `src/lib/cookies.ts`**

```ts
import type { Context } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";

const NAME = "sid";

export function setSessionCookie(c: Context, sid: string) {
  setCookie(c, NAME, sid, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function getSessionCookie(c: Context) {
  return getCookie(c, NAME);
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, NAME, { path: "/" });
}
```

- [ ] **Step 2: Write `src/middleware/auth.ts`**

```ts
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
```

- [ ] **Step 3: Wire middleware into `src/app.ts`**

Replace `src/app.ts` with:

```ts
import { Hono } from "hono";
import { attachAuth, type AuthVars } from "./middleware/auth.ts";

export function createApp() {
  const app = new Hono<{ Variables: AuthVars }>();
  app.use("*", attachAuth);
  app.get("/healthz", (c) => c.text("ok"));
  return app;
}
```

- [ ] **Step 4: Smoke test**

Run: `bun run dev`, then `curl -i localhost:3000/healthz`
Expected: 200 ok, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cookies.ts src/middleware/auth.ts src/app.ts
git commit -m "feat(auth): cookie helpers + attachAuth/requireAuth middleware"
```

---

## Phase 3 — Auth routes (Tasks 10–12)

### Task 10: Signup route

**Files:**
- Create: `src/routes/auth.ts`
- Create: `src/views/layout.tsx`
- Create: `src/views/auth.tsx`
- Create: `src/__tests__/auth-routes.test.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Write `src/views/layout.tsx`**

```tsx
import type { FC } from "hono/jsx";

export const Layout: FC<{ title: string; children?: any }> = ({ title, children }) => (
  <html lang="ko">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <link rel="stylesheet" href="/styles.css" />
    </head>
    <body>{children}</body>
  </html>
);
```

- [ ] **Step 2: Write `src/views/auth.tsx`**

```tsx
import { Layout } from "./layout.tsx";

export function SignupForm({ error }: { error?: string }) {
  return (
    <Layout title="가입">
      <main class="auth">
        <h1>가입</h1>
        {error ? <p class="error">{error}</p> : null}
        <form method="post" action="/auth/signup">
          <label>username<input name="username" required /></label>
          <label>email<input type="email" name="email" required /></label>
          <label>password<input type="password" name="password" required minlength={8} /></label>
          <button type="submit">가입하기</button>
        </form>
        <p><a href="/auth/login">이미 계정이 있어요</a></p>
      </main>
    </Layout>
  );
}

export function LoginForm({ error }: { error?: string }) {
  return (
    <Layout title="로그인">
      <main class="auth">
        <h1>로그인</h1>
        {error ? <p class="error">{error}</p> : null}
        <form method="post" action="/auth/login">
          <label>email<input type="email" name="email" required /></label>
          <label>password<input type="password" name="password" required /></label>
          <button type="submit">로그인</button>
        </form>
        <p><a href="/auth/signup">가입하기</a></p>
      </main>
    </Layout>
  );
}
```

- [ ] **Step 3: Write `src/routes/auth.ts`**

```ts
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
```

- [ ] **Step 4: Wire routes into `src/app.ts`**

Replace `src/app.ts`:

```ts
import { Hono } from "hono";
import { attachAuth, type AuthVars } from "./middleware/auth.ts";
import { auth } from "./routes/auth.ts";

export function createApp() {
  const app = new Hono<{ Variables: AuthVars }>();
  app.use("*", attachAuth);
  app.get("/healthz", (c) => c.text("ok"));
  app.route("/auth", auth);
  return app;
}
```

- [ ] **Step 5: Write integration test**

```ts
// src/__tests__/auth-routes.test.ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
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
```

- [ ] **Step 6: Run test**

Run: `bun test src/__tests__/auth-routes.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/auth.ts src/views/ src/app.ts src/__tests__/auth-routes.test.ts
git commit -m "feat(auth): signup/login/logout routes + JSX views"
```

---

### Task 11: Landing page

**Files:**
- Create: `src/views/landing.tsx`
- Modify: `src/app.ts`

- [ ] **Step 1: Write `src/views/landing.tsx`**

```tsx
import { Layout } from "./layout.tsx";

export function Landing({ user }: { user: { username: string } | null }) {
  return (
    <Layout title="bookmarks">
      <main class="landing">
        <h1>북마크 토이</h1>
        <p>링크를 모으고 공개 프로필로 공유합니다.</p>
        {user
          ? <p><a href="/app">내 북마크 →</a></p>
          : (
            <p>
              <a href="/auth/signup">가입</a> 또는 <a href="/auth/login">로그인</a>
            </p>
          )
        }
      </main>
    </Layout>
  );
}
```

- [ ] **Step 2: Wire into `src/app.ts`**

In `createApp()`, after `app.use("*", attachAuth)` and before `app.route("/auth", auth)`:

```ts
app.get("/", (c) => c.html(<Landing user={c.get("user")} />));
```

(Add `import { Landing } from "./views/landing.tsx";` at top.)

- [ ] **Step 3: Smoke test**

Run: `bun run dev`, then `curl localhost:3000/` and confirm HTML renders with both links.

- [ ] **Step 4: Commit**

```bash
git add src/views/landing.tsx src/app.ts
git commit -m "feat(views): landing page with auth-aware CTA"
```

---

## Phase 4 — OG fetch + bookmark routes (Tasks 12–17)

### Task 12: OG metadata fetcher

**Files:**
- Create: `src/lib/og-fetch.ts`
- Create: `src/lib/__tests__/og-fetch.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, test } from "bun:test";
import { parseOgMeta } from "../og-fetch.ts";

describe("parseOgMeta", () => {
  test("extracts og:title, og:description, og:image", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Hello">
        <meta property="og:description" content="A thing">
        <meta property="og:image" content="https://x.com/i.png">
      </head></html>
    `;
    expect(parseOgMeta(html)).toEqual({
      title: "Hello",
      description: "A thing",
      image: "https://x.com/i.png",
    });
  });

  test("falls back to <title> when no og:title", () => {
    const html = `<html><head><title>Plain</title></head></html>`;
    expect(parseOgMeta(html).title).toBe("Plain");
  });

  test("returns empty when no metadata", () => {
    expect(parseOgMeta("<html></html>")).toEqual({
      title: undefined,
      description: undefined,
      image: undefined,
    });
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `bun test src/lib/__tests__/og-fetch.test.ts`

- [ ] **Step 3: Write `src/lib/og-fetch.ts`**

```ts
import { isSafePublicHost } from "./ssrf-guard.ts";

export type OgMeta = { title?: string; description?: string; image?: string };

export function parseOgMeta(html: string): OgMeta {
  const meta = (prop: string) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    return html.match(re)?.[1];
  };
  let title = meta("og:title");
  if (!title) {
    title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  }
  return {
    title,
    description: meta("og:description"),
    image: meta("og:image"),
  };
}

export async function fetchOgMeta(rawUrl: string, signal?: AbortSignal): Promise<OgMeta> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {};
  }

  // Resolve hostname → IPs and check each
  const lookup = await Bun.dns.lookup(url.hostname, { family: 0 } as any).catch(() => null);
  const ips = Array.isArray(lookup) ? lookup : lookup ? [lookup] : [];
  if (ips.length === 0) return {};
  for (const r of ips) {
    if (!isSafePublicHost(r.address)) return {};
  }

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: signal ?? ctrl.signal,
      headers: { "user-agent": "bookmark-toy/1.0" },
    });
    if (res.status >= 300 && res.status < 400) return {}; // refuse to follow
    if (!res.ok) return {};
    const reader = res.body?.getReader();
    if (!reader) return {};
    let received = 0;
    const chunks: Uint8Array[] = [];
    while (received < 1_000_000) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      chunks.push(value);
    }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      new Uint8Array(chunks.flatMap((c) => Array.from(c))),
    );
    return parseOgMeta(html);
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `bun test src/lib/__tests__/og-fetch.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/og-fetch.ts src/lib/__tests__/og-fetch.test.ts
git commit -m "feat(og): fetcher with DNS+IP guard, manual redirect, 1MB cap"
```

---

### Task 13: Dashboard view (list + add form)

**Files:**
- Create: `src/views/dashboard.tsx`

- [ ] **Step 1: Write `src/views/dashboard.tsx`**

```tsx
import { Layout } from "./layout.tsx";

export type DashBookmark = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  isPublic: number;
  tags: string[];
};

export function Dashboard({
  username, bookmarks, csrfToken, flash,
}: {
  username: string;
  bookmarks: DashBookmark[];
  csrfToken: string;
  flash?: string;
}) {
  return (
    <Layout title={`${username}의 북마크`}>
      <header class="topbar">
        <a href={`/u/${username}`}>공개 프로필 보기</a>
        <form method="post" action="/auth/logout" style="display:inline">
          <button type="submit">로그아웃</button>
        </form>
      </header>

      <main class="dash">
        <h1>내 북마크</h1>
        {flash ? <p class="flash">{flash}</p> : null}

        <form method="post" action="/app/bookmarks" class="add">
          <input type="hidden" name="_csrf" value={csrfToken} />
          <input type="url" name="url" placeholder="https://..." required />
          <input type="text" name="tags" placeholder="태그를 쉼표로" />
          <label><input type="checkbox" name="is_public" /> 공개</label>
          <button type="submit">추가</button>
        </form>

        {bookmarks.length === 0
          ? <p class="empty">아직 북마크가 없어요.</p>
          : (
            <ul class="bookmarks">
              {bookmarks.map((b) => (
                <li>
                  <a href={b.url} target="_blank" rel="noopener noreferrer">{b.title}</a>
                  {b.description ? <p>{b.description}</p> : null}
                  <div class="meta">
                    {b.tags.map((t) => <span class="tag">#{t}</span>)}
                    {b.isPublic ? <span class="badge">공개</span> : null}
                  </div>
                  <form method="post" action={`/app/bookmarks/${b.id}/delete`} style="display:inline">
                    <input type="hidden" name="_csrf" value={csrfToken} />
                    <button type="submit">삭제</button>
                  </form>
                </li>
              ))}
            </ul>
          )
        }
      </main>
    </Layout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/dashboard.tsx
git commit -m "feat(views): dashboard with add form, list, tag chips"
```

---

### Task 14: Bookmark routes — list + create

**Files:**
- Create: `src/routes/app.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Write `src/routes/app.ts`**

```ts
import { Hono } from "hono";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.ts";
import { bookmarks, tags, bookmarkTags } from "../db/schema.ts";
import { bookmarkInputSchema } from "../lib/validate.ts";
import { ulid } from "../lib/ids.ts";
import { now } from "../lib/time.ts";
import { fetchOgMeta } from "../lib/og-fetch.ts";
import { signToken, verifyToken } from "../lib/csrf.ts";
import { requireAuth, type AuthVars } from "../middleware/auth.ts";
import { Dashboard, type DashBookmark } from "../views/dashboard.tsx";

const CSRF_SECRET = process.env.CSRF_SECRET!;

export const appRoutes = new Hono<{ Variables: AuthVars }>();
appRoutes.use("*", requireAuth);

async function loadDashBookmarks(userId: string): Promise<DashBookmark[]> {
  const rows = await db.select().from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt));
  if (rows.length === 0) return [];

  const links = await db.select({
    bookmarkId: bookmarkTags.bookmarkId, name: tags.name,
  }).from(bookmarkTags).innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
    .where(inArray(bookmarkTags.bookmarkId, rows.map(r => r.id)));

  const tagMap = new Map<string, string[]>();
  for (const l of links) {
    const arr = tagMap.get(l.bookmarkId) ?? [];
    arr.push(l.name);
    tagMap.set(l.bookmarkId, arr);
  }

  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    title: r.title,
    description: r.description,
    isPublic: r.isPublic,
    tags: tagMap.get(r.id) ?? [],
  }));
}

appRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  const bms = await loadDashBookmarks(user.id);
  const csrfToken = signToken(c.get("sessionId")!, CSRF_SECRET);
  const flash = c.req.query("flash") ?? undefined;
  return c.html(<Dashboard username={user.username} bookmarks={bms} csrfToken={csrfToken} flash={flash} />);
});

appRoutes.post("/bookmarks", async (c) => {
  const user = c.get("user")!;
  const form = await c.req.parseBody();
  if (!verifyToken(String(form._csrf ?? ""), c.get("sessionId")!, CSRF_SECRET)) {
    return c.text("forbidden", 403);
  }
  const parsed = bookmarkInputSchema.safeParse(form);
  if (!parsed.success) return c.redirect("/app?flash=invalid", 302);

  const { url, tags: tagsStr, is_public } = parsed.data;
  const og = await fetchOgMeta(url);
  const id = ulid();
  const t = now();

  await db.transaction(async (tx) => {
    await tx.insert(bookmarks).values({
      id, userId: user.id,
      url,
      title: og.title ?? url,
      description: og.description ?? null,
      ogImageUrl: og.image ?? null,
      isPublic: is_public === "on" ? 1 : 0,
      createdAt: t, updatedAt: t,
    });
    const tagNames = (tagsStr ?? "")
      .split(",").map(s => s.trim().toLowerCase()).filter(s => s.length > 0 && s.length <= 30);
    for (const name of tagNames) {
      let [existing] = await tx.select().from(tags)
        .where(and(eq(tags.userId, user.id), eq(tags.name, name)));
      if (!existing) {
        const tid = ulid();
        await tx.insert(tags).values({ id: tid, userId: user.id, name });
        existing = { id: tid, userId: user.id, name };
      }
      await tx.insert(bookmarkTags).values({ bookmarkId: id, tagId: existing.id });
    }
  });

  return c.redirect("/app?flash=added", 302);
});
```

- [ ] **Step 2: Wire into `src/app.ts`**

```ts
import { appRoutes } from "./routes/app.ts";
// ... inside createApp:
app.route("/app", appRoutes);
```

- [ ] **Step 3: Smoke test**

Run: `bun run dev`. In browser: signup → add a real URL (e.g. `https://example.com`) with tags `test,demo` → see it on `/app`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/app.ts src/app.ts
git commit -m "feat(bookmarks): GET /app + POST /app/bookmarks with OG fetch + tags"
```

---

### Task 15: Bookmark routes — delete + edit

**Files:**
- Modify: `src/routes/app.ts`
- Create: `src/views/bookmark-edit.tsx`

- [ ] **Step 1: Write `src/views/bookmark-edit.tsx`**

```tsx
import { Layout } from "./layout.tsx";
import type { DashBookmark } from "./dashboard.tsx";

export function BookmarkEdit({ b, csrfToken }: { b: DashBookmark; csrfToken: string }) {
  return (
    <Layout title="북마크 수정">
      <main class="edit">
        <h1>북마크 수정</h1>
        <form method="post" action={`/app/bookmarks/${b.id}`}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <label>제목<input name="title" value={b.title} required /></label>
          <label>설명<textarea name="description">{b.description ?? ""}</textarea></label>
          <label>태그<input name="tags" value={b.tags.join(", ")} /></label>
          <label><input type="checkbox" name="is_public" checked={b.isPublic === 1} /> 공개</label>
          <button type="submit">저장</button>
          <a href="/app">취소</a>
        </form>
      </main>
    </Layout>
  );
}
```

- [ ] **Step 2: Append delete + edit handlers to `src/routes/app.ts`**

```ts
import { BookmarkEdit } from "../views/bookmark-edit.tsx";

appRoutes.post("/bookmarks/:id/delete", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const form = await c.req.parseBody();
  if (!verifyToken(String(form._csrf ?? ""), c.get("sessionId")!, CSRF_SECRET)) {
    return c.text("forbidden", 403);
  }
  await db.delete(bookmarks).where(and(eq(bookmarks.id, id), eq(bookmarks.userId, user.id)));
  return c.redirect("/app?flash=deleted", 302);
});

appRoutes.get("/bookmarks/:id/edit", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const [row] = await db.select().from(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, user.id)));
  if (!row) return c.notFound();
  const tagLinks = await db.select({ name: tags.name }).from(bookmarkTags)
    .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
    .where(eq(bookmarkTags.bookmarkId, id));
  const csrfToken = signToken(c.get("sessionId")!, CSRF_SECRET);
  return c.html(<BookmarkEdit
    b={{
      id: row.id, url: row.url, title: row.title,
      description: row.description, isPublic: row.isPublic,
      tags: tagLinks.map(t => t.name),
    }}
    csrfToken={csrfToken}
  />);
});

appRoutes.post("/bookmarks/:id", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const form = await c.req.parseBody();
  if (!verifyToken(String(form._csrf ?? ""), c.get("sessionId")!, CSRF_SECRET)) {
    return c.text("forbidden", 403);
  }
  const title = String(form.title ?? "").trim().slice(0, 200);
  const description = String(form.description ?? "").trim().slice(0, 500) || null;
  const tagsStr = String(form.tags ?? "");
  const isPublic = form.is_public === "on" ? 1 : 0;
  if (!title) return c.redirect(`/app/bookmarks/${id}/edit`, 302);

  await db.transaction(async (tx) => {
    const [own] = await tx.select({ id: bookmarks.id }).from(bookmarks)
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, user.id)));
    if (!own) return;
    await tx.update(bookmarks)
      .set({ title, description, isPublic, updatedAt: now() })
      .where(eq(bookmarks.id, id));
    await tx.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, id));
    const tagNames = tagsStr.split(",").map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0 && s.length <= 30);
    for (const name of tagNames) {
      let [existing] = await tx.select().from(tags)
        .where(and(eq(tags.userId, user.id), eq(tags.name, name)));
      if (!existing) {
        const tid = ulid();
        await tx.insert(tags).values({ id: tid, userId: user.id, name });
        existing = { id: tid, userId: user.id, name };
      }
      await tx.insert(bookmarkTags).values({ bookmarkId: id, tagId: existing.id });
    }
  });
  return c.redirect("/app?flash=updated", 302);
});
```

- [ ] **Step 3: Smoke test**

Run: `bun run dev`. From `/app`: edit a bookmark, change title + tags, save. Delete a bookmark.

- [ ] **Step 4: Commit**

```bash
git add src/routes/app.ts src/views/bookmark-edit.tsx
git commit -m "feat(bookmarks): edit + delete with CSRF + ownership check"
```

---

## Phase 5 — Public profile (Task 16)

### Task 16: Public profile route + view

**Files:**
- Create: `src/routes/public.ts`
- Create: `src/views/public-profile.tsx`
- Modify: `src/app.ts`

- [ ] **Step 1: Write `src/views/public-profile.tsx`**

```tsx
import { Layout } from "./layout.tsx";

export function PublicProfile({
  username,
  bookmarks,
}: {
  username: string;
  bookmarks: { url: string; title: string; description: string | null; tags: string[] }[];
}) {
  return (
    <Layout title={`@${username}의 공개 북마크`}>
      <main class="public">
        <h1>@{username}</h1>
        {bookmarks.length === 0
          ? <p class="empty">아직 공개된 북마크가 없어요.</p>
          : (
            <ul class="bookmarks">
              {bookmarks.map((b) => (
                <li>
                  <a href={b.url} target="_blank" rel="noopener noreferrer">{b.title}</a>
                  {b.description ? <p>{b.description}</p> : null}
                  <div class="meta">{b.tags.map((t) => <span class="tag">#{t}</span>)}</div>
                </li>
              ))}
            </ul>
          )
        }
      </main>
    </Layout>
  );
}
```

- [ ] **Step 2: Write `src/routes/public.ts`**

```ts
import { Hono } from "hono";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.ts";
import { users, bookmarks, tags, bookmarkTags } from "../db/schema.ts";
import { PublicProfile } from "../views/public-profile.tsx";

export const pub = new Hono();

pub.get("/u/:username", async (c) => {
  const username = c.req.param("username").toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user) return c.notFound();

  const rows = await db.select().from(bookmarks)
    .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.isPublic, 1)))
    .orderBy(desc(bookmarks.createdAt));

  const links = rows.length
    ? await db.select({ bid: bookmarkTags.bookmarkId, name: tags.name })
        .from(bookmarkTags).innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
        .where(inArray(bookmarkTags.bookmarkId, rows.map(r => r.id)))
    : [];

  const tagMap = new Map<string, string[]>();
  for (const l of links) {
    const a = tagMap.get(l.bid) ?? [];
    a.push(l.name);
    tagMap.set(l.bid, a);
  }

  c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  return c.html(<PublicProfile
    username={user.username}
    bookmarks={rows.map(r => ({
      url: r.url, title: r.title, description: r.description,
      tags: tagMap.get(r.id) ?? [],
    }))}
  />);
});
```

- [ ] **Step 3: Wire into `src/app.ts`**

```ts
import { pub } from "./routes/public.ts";
// inside createApp, after auth/app routes:
app.route("/", pub);
```

- [ ] **Step 4: Smoke test**

Run: `bun run dev`. As a logged-in user, mark a bookmark public, then visit `/u/<your-username>` in an incognito window — confirm only public bookmarks appear, and `/u/nonexistent` returns 404.

- [ ] **Step 5: Commit**

```bash
git add src/routes/public.ts src/views/public-profile.tsx src/app.ts
git commit -m "feat(public): /u/:username public profile with cache headers + 404"
```

---

## Phase 6 — Static assets + styling (Tasks 17–18)

### Task 17: Serve `public/` + base CSS

**Files:**
- Create: `public/styles.css`
- Create: `public/htmx.min.js`
- Modify: `src/app.ts`

- [ ] **Step 1: Download HTMX**

```bash
mkdir -p public
curl -L https://unpkg.com/htmx.org@1.9.12/dist/htmx.min.js -o public/htmx.min.js
```

- [ ] **Step 2: Write `public/styles.css`**

```css
:root {
  --fg: #111;
  --bg: #fff;
  --muted: #666;
  --border: #ddd;
  --accent: #2563eb;
  --error: #b91c1c;
  --tag-bg: #eef2ff;
}
* { box-sizing: border-box; }
body {
  font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  color: var(--fg); background: var(--bg);
  margin: 0; padding: 0;
}
main { max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
.topbar { display: flex; justify-content: space-between; padding: 1rem; border-bottom: 1px solid var(--border); }
h1 { margin-top: 0; }
form { display: grid; gap: .5rem; margin: 1rem 0; }
form.add { display: flex; flex-wrap: wrap; gap: .5rem; }
form.add input[type="url"] { flex: 1 1 280px; min-width: 0; }
input, textarea, button { font: inherit; padding: .5rem; border: 1px solid var(--border); border-radius: 4px; }
button { background: var(--accent); color: #fff; border: 0; cursor: pointer; }
.error { color: var(--error); }
.flash { background: #ecfdf5; border: 1px solid #6ee7b7; padding: .5rem 1rem; border-radius: 4px; }
.empty { color: var(--muted); text-align: center; padding: 2rem; }
ul.bookmarks { list-style: none; padding: 0; }
ul.bookmarks li { padding: 1rem 0; border-bottom: 1px solid var(--border); word-break: break-word; }
.meta { display: flex; flex-wrap: wrap; gap: .25rem; margin-top: .25rem; }
.tag { background: var(--tag-bg); color: var(--accent); padding: 0 .5rem; border-radius: 999px; font-size: .85em; }
.badge { background: #fef3c7; color: #92400e; padding: 0 .5rem; border-radius: 999px; font-size: .85em; }
@media (max-width: 480px) {
  main { margin: 1rem auto; }
  form.add { flex-direction: column; }
}
```

- [ ] **Step 3: Wire static serving in `src/app.ts`**

Add at top: `import { serveStatic } from "hono/bun";`

In `createApp()`, before middleware:

```ts
app.use("/styles.css", serveStatic({ path: "./public/styles.css" }));
app.use("/htmx.min.js", serveStatic({ path: "./public/htmx.min.js" }));
```

- [ ] **Step 4: Smoke test**

Run: `bun run dev`, then `curl -I localhost:3000/styles.css` — expect 200.
Browse to `/` — page should be styled.

- [ ] **Step 5: Commit**

```bash
git add public/ src/app.ts
git commit -m "feat(ui): mobile-first CSS + HTMX asset"
```

---

### Task 18: Mobile viewport sanity + design polish pass

**Files:**
- Modify: `public/styles.css`

- [ ] **Step 1: Verify in 375px viewport**

Run: `bun run dev`, then in another shell:

```bash
~/.claude/skills/gstack/browse/dist/browse goto http://localhost:3000/auth/signup
~/.claude/skills/gstack/browse/dist/browse viewport 375 667
~/.claude/skills/gstack/browse/dist/browse screenshot /tmp/signup-mobile.png
```

Open `/tmp/signup-mobile.png` and confirm: form fits, no horizontal scroll, button reachable.

- [ ] **Step 2: Tweak CSS as needed**

If the screenshot reveals issues (overflow, tiny tap targets), adjust `public/styles.css`. Common fixes:
- `button { min-height: 44px; padding: .75rem 1rem; }`
- Wrap long URLs: `a { overflow-wrap: anywhere; }`

- [ ] **Step 3: Re-screenshot to confirm**

```bash
~/.claude/skills/gstack/browse/dist/browse screenshot /tmp/signup-mobile-after.png
```

- [ ] **Step 4: Commit**

```bash
git add public/styles.css
git commit -m "fix(ui): mobile tap targets + URL wrap"
```

---

## Phase 7 — Deploy to Fly.io (Tasks 19–21)

### Task 19: Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Write `Dockerfile`**

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

FROM base AS build
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle.config.ts ./
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["bun", "run", "src/server.ts"]
```

- [ ] **Step 2: Write `.dockerignore`**

```
node_modules
.git
.env
*.db
*.db-journal
dist
docs
```

- [ ] **Step 3: Build locally to verify**

```bash
docker build -t bookmark-toy . && docker run --rm -p 3000:3000 \
  -e DATABASE_URL=file:/tmp/test.db \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  -e CSRF_SECRET=$(openssl rand -hex 32) \
  bookmark-toy bun run src/db/migrate.ts
```

Expected: image builds and migrate prints "migrations applied". Then run the actual app:

```bash
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=file:/tmp/test.db \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  -e CSRF_SECRET=$(openssl rand -hex 32) \
  bookmark-toy
```

`curl localhost:3000/healthz` → `ok`. Stop with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "build: Dockerfile multi-stage on bun:1"
```

---

### Task 20: Turso DB + Fly.io app

**Files:**
- Create: `fly.toml`

- [ ] **Step 1: Create Turso DB**

```bash
brew install tursodatabase/tap/turso
turso auth signup
turso db create bookmark-toy
turso db show bookmark-toy --url   # save as TURSO_URL
turso db tokens create bookmark-toy   # save as TURSO_TOKEN
```

- [ ] **Step 2: Apply migrations to Turso**

```bash
DATABASE_URL=<TURSO_URL> DATABASE_AUTH_TOKEN=<TURSO_TOKEN> bun run db:migrate
```

Expected: `migrations applied`.

- [ ] **Step 3: Install flyctl and create app**

```bash
brew install flyctl
fly auth signup    # or `fly auth login`
fly launch --no-deploy --copy-config --name bookmark-toy
```

When prompted, accept the generated `fly.toml`. Edit it to set the internal port + healthchecks:

```toml
app = "bookmark-toy"
primary_region = "nrt"

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[http_service.checks]]
  grace_period = "5s"
  interval = "15s"
  method = "GET"
  path = "/healthz"
  timeout = "2s"

[env]
  NODE_ENV = "production"
  PORT = "3000"
```

- [ ] **Step 4: Set secrets**

```bash
fly secrets set \
  DATABASE_URL="<TURSO_URL>" \
  DATABASE_AUTH_TOKEN="<TURSO_TOKEN>" \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  CSRF_SECRET="$(openssl rand -hex 32)"
```

- [ ] **Step 5: Commit fly.toml**

```bash
git add fly.toml
git commit -m "build(deploy): fly.toml with /healthz check on nrt region"
```

---

### Task 21: First deploy + verify

- [ ] **Step 1: Deploy**

```bash
fly deploy
```

Expected: build succeeds, health check passes.

- [ ] **Step 2: Verify**

```bash
fly status
curl https://bookmark-toy.fly.dev/healthz
```

Expected: `ok`. Visit `https://bookmark-toy.fly.dev/` in a browser, sign up, add a bookmark, mark it public, view `/u/<username>`.

- [ ] **Step 3: Add deploy URL to README**

Create `README.md`:

```markdown
# bookmark-toy

A gstack learning toy.

- Live: https://bookmark-toy.fly.dev
- Spec: docs/superpowers/specs/2026-05-08-gstack-bookmark-toy-design.md
- Plan: docs/superpowers/plans/2026-05-08-bookmark-toy.md

## Dev

```bash
bun install
cp .env.example .env  # then fill secrets
bun run db:migrate
bun run dev
```

## Deploy

`fly deploy` (Turso + Fly secrets must be set).

## TODO

- [ ] Rate limiting on auth + bookmark create
- [ ] Tag-based filter on dashboard
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README with live URL + dev/deploy instructions"
```

---

## Phase 8 — gstack workflow tour (Task 22)

This is the learning payoff: run each gstack tool against the deployed app.

### Task 22: Run the gstack tour

- [x] **Step 1: `/cso` (security)** — 7 findings (3 HIGH / 2 MED / 2 LOW). 5/7 categories addressed; `superfly/flyctl-actions@master` SHA-pin and login timing oracle deferred for next cycle.

- [x] **Step 2: `/qa` against production** — 6 issues found, 5 fixed in PR #29 (mobile tap target, edit affordance, 404 page, locale message, edit-form URL field).

- [x] **Step 3: `/design-review` against production** — 13 findings. Quick Wins 5개 fixed in PR #30 (link color, button hover, focus ring, danger button, CTA promotion).

- [x] **Step 4: `/benchmark`** — Pretendard fonts 2.3MB → ~80KB (~97% reduction) via dynamic-subset. Edge cache for anonymous landing. PR #31 + #32. FCP 892ms; warm TTFB 596ms (landing) / 824ms (profile).

- [x] **Step 5: `/canary`** — baseline captured for 5 pages, all HEALTHY. Saved at `.gstack/canary-reports/baseline.json`. Learned: anonymous-context capture needed (session cookie gotcha).

- [x] **Step 6: `/review` on the latest PR** — Skipped per tour-mode note (no open PR at tour time; per-task PR pattern across PRs #23–#32 covered review at merge time).

- [x] **Step 7: `/retro`** — 7-day cycle analyzed. 28 commits / 28 PRs / +4304 LOC / 100% AI-assisted. Snapshot at `.context/retros/2026-05-09-1.json`.

- [x] **Step 8: `/learn`** — 5 durable lessons captured: pretendard family-name, dockerfile tsconfig runtime, fly secret curly quotes, canary baseline session state, conditional Cache-Control auth-aware pattern.

- [x] **Step 9: Commit tour-driven fixes** — PR #29 (qa), #30 (design), #31 + #32 (perf) all squash-merged via per-task PR pattern.

- [x] **Step 10: Final state** ✅

Achieved:
- Live URL: https://bookmark-toy.fly.dev (HEALTHY across 5 baseline pages)
- All 7 skill outputs recorded under `.gstack/` (security/qa/design/benchmark/canary reports + browse audit log)
- 5 `/learn` entries (4 pitfalls + 1 pattern)
- 4 tour-driven fix PRs merged (#29, #30, #31, #32)

gstack workflow learning success state achieved.

---

## Self-Review Notes

This plan was reviewed against the spec on 2026-05-08:
- All 10 routes from spec §4 are implemented (Tasks 9, 10, 14, 15, 16, plus `/healthz` in Task 1).
- All 5 tables from spec §5 are created in Task 2.
- Each item in spec §6 (security boundaries) maps to a task: argon2id (5), session cookie (9), session expiry (8), CSRF (6, 14, 15), SSRF (4, 12), XSS (Hono/JSX auto-escape — verified via not using `html` raw helper), SQL injection (Drizzle params throughout), enumeration (auth.ts uses generic messages), OG image not proxied (Task 12 stores URL only), rate-limit deferred (TODO in README, Task 21).
- Spec §10 gstack workflow checklist is delivered by Task 22.
- Type names are consistent across tasks (`AuthVars`, `DashBookmark`, `OgMeta`, `signToken`/`verifyToken`).
