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
