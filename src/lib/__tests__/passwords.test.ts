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
