import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

const ADMIN_COOKIE = "bookhub_admin";

type AdminConfig = {
  username: string;
  password: string;
  secret: string;
};

function getAdminConfig(): AdminConfig | null {
  const username = process.env.ADMIN_PANEL_USERNAME;
  const password = process.env.ADMIN_PANEL_PASSWORD;
  if (!username || !password) return null;
  const secret = process.env.ADMIN_PANEL_SECRET || password;
  return { username, password, secret };
}

function shouldUseSecureCookie() {
  const url = process.env.NEXTAUTH_URL || "";
  if (url.startsWith("https://")) return true;
  if (url.startsWith("http://")) return false;
  return process.env.NODE_ENV === "production";
}

function buildAdminToken(config: AdminConfig) {
  return createHmac("sha256", config.secret).update(`${config.username}:${config.password}`).digest("hex");
}

function tokensMatch(a: string, b: string) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function getAdminUsername() {
  return getAdminConfig()?.username || null;
}

export function isAdminToken(token?: string | null) {
  const config = getAdminConfig();
  if (!config || !token) return false;
  const expected = buildAdminToken(config);
  return tokensMatch(token, expected);
}

export function isAdminRequest(req: NextRequest) {
  return isAdminToken(req.cookies.get(ADMIN_COOKIE)?.value ?? null);
}

export function isAdminSession() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  return isAdminToken(token ?? null);
}

export function setAdminCookie(res: NextResponse) {
  const config = getAdminConfig();
  if (!config) throw new Error("ADMIN_CREDENTIALS_MISSING");
  const token = buildAdminToken(config);
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export function clearAdminCookie(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: 0,
  });
}

export function assertAdminConfig() {
  if (!getAdminConfig()) {
    throw new Error("ADMIN_CREDENTIALS_MISSING");
  }
}

export function verifyAdminCredentials(username: string, password: string) {
  const config = getAdminConfig();
  if (!config) return false;
  return config.username === username && config.password === password;
}
