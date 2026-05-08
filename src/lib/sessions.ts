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
