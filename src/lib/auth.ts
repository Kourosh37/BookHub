import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "bookhub_session";
const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "dev_secret");

function getSessionExpiresDays() {
  const raw = Number(process.env.SESSION_EXPIRES_DAYS || "7");
  if (Number.isNaN(raw) || raw < 1) return 7;
  return raw;
}

function shouldUseSecureCookie() {
  const url = process.env.NEXTAUTH_URL || "";
  if (url.startsWith("https://")) return true;
  if (url.startsWith("http://")) return false;
  return process.env.NODE_ENV === "production";
}

export type SessionPayload = {
  userId: string;
  phone: string;
};

export async function createSession(payload: SessionPayload) {
  const sessionDays = getSessionExpiresDays();
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${sessionDays}d`)
    .sign(secret);

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: 60 * 60 * 24 * sessionDays,
  });
}

export function clearSession() {
  cookies().delete(COOKIE_NAME);
}

export async function getSession() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}
