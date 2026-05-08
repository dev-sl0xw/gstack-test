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
