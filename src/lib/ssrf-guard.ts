export function isSafePublicHost(host: string): boolean {
  // strip brackets from IPv6 literals
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();

  // IPv4
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = v4.slice(1, 3).map(Number);
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 0) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
    return true;
  }

  // IPv6
  if (h.includes(":")) {
    if (h === "::1" || h === "::") return false;
    if (h.startsWith("fe80:")) return false;
    if (h.startsWith("fc") || h.startsWith("fd")) return false;
    return true;
  }

  return false; // hostname, not an IP — caller resolves first
}
