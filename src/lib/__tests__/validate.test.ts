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
