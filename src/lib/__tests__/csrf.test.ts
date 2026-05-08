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
