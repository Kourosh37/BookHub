import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { prisma } from "@/lib/prisma";
import { secretKey, secureCookies } from "@/lib/config";

export const ADMIN_COOKIE = "bookhub_admin";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const equal = (a: string, b: string) =>
  timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));

function configHash() {
  const username = process.env.ADMIN_PANEL_USERNAME;
  const password = process.env.ADMIN_PANEL_PASSWORD;
  if (!username || !password || /^(change[-_])/i.test(password))
    throw new Error("ADMIN_CREDENTIALS_MISSING");
  return createHmac("sha256", secretKey("ADMIN_PANEL_SECRET"))
    .update(`${username}:${password}`)
    .digest("hex");
}
export function getAdminUsername() {
  return process.env.ADMIN_PANEL_USERNAME || null;
}
export function assertAdminConfig() {
  configHash();
}
export async function isAdminToken(token?: string | null) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hash(token) },
  });
  return Boolean(
    session &&
    session.expiresAt > new Date() &&
    equal(session.configHash, configHash()),
  );
}
export async function isAdminRequest(req: NextRequest) {
  return isAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);
}
export async function isAdminSession() {
  return isAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}
export async function setAdminCookie(res: NextResponse) {
  const token = randomBytes(32).toString("hex");
  await prisma.adminSession.create({
    data: {
      tokenHash: hash(token),
      adminUser: getAdminUsername()!,
      configHash: configHash(),
      expiresAt: new Date(Date.now() + 8 * 3600000),
    },
  });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookies(),
    path: "/",
    maxAge: 8 * 3600,
  });
}
export async function clearAdminCookie(res: NextResponse, req: Request) {
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);
  if (token)
    await prisma.adminSession.deleteMany({ where: { tokenHash: hash(token) } });
  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookies(),
    path: "/",
    maxAge: 0,
  });
}
export function verifyAdminCredentials(username: string, password: string) {
  assertAdminConfig();
  return (
    equal(username, process.env.ADMIN_PANEL_USERNAME!) &&
    equal(password, process.env.ADMIN_PANEL_PASSWORD!)
  );
}
