import { createHmac, timingSafeEqual } from "node:crypto";

export function signToken(sessionId: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(sessionId).digest("hex");
  return mac;
}

export function verifyToken(token: string, sessionId: string, secret: string): boolean {
  const expected = signToken(sessionId, secret);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
