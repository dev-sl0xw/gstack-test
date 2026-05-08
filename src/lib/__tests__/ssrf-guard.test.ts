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
