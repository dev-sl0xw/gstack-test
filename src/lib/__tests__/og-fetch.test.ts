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
