import type { Context } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";

const NAME = "sid";

export function setSessionCookie(c: Context, sid: string) {
  setCookie(c, NAME, sid, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function getSessionCookie(c: Context) {
  return getCookie(c, NAME);
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, NAME, { path: "/" });
}
