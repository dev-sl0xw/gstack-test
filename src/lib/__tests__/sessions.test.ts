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
