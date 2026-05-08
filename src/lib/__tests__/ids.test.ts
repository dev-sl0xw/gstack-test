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
