import { isSafePublicHost } from "./ssrf-guard.ts";

export type OgMeta = { title?: string; description?: string; image?: string };

export function parseOgMeta(html: string): OgMeta {
  const meta = (prop: string) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    return html.match(re)?.[1];
  };
  let title = meta("og:title");
  if (!title) {
    title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  }
  return {
    title,
    description: meta("og:description"),
    image: meta("og:image"),
  };
}

export async function fetchOgMeta(rawUrl: string, signal?: AbortSignal): Promise<OgMeta> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {};
  }

  // Resolve hostname → IPs and check each
  const lookup = await Bun.dns.lookup(url.hostname, { family: 0 } as any).catch(() => null);
  const ips = Array.isArray(lookup) ? lookup : lookup ? [lookup] : [];
  if (ips.length === 0) return {};
  for (const r of ips) {
    if (!isSafePublicHost(r.address)) return {};
  }

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: signal ?? ctrl.signal,
      headers: { "user-agent": "bookmark-toy/1.0" },
    });
    if (res.status >= 300 && res.status < 400) return {}; // refuse to follow
    if (!res.ok) return {};
    const reader = res.body?.getReader();
    if (!reader) return {};
    let received = 0;
    const chunks: Uint8Array[] = [];
    while (received < 1_000_000) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      chunks.push(value);
    }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      new Uint8Array(chunks.flatMap((c) => Array.from(c))),
    );
    return parseOgMeta(html);
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}
