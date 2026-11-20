import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/errors";
import { positiveInt, secretKey, secureCookies } from "@/lib/config";

export const SESSION_COOKIE = "bookhub_session";
export type SessionPayload = {
  userId: string;
  phone: string;
  sessionVersion?: number;
};

export async function createSession(payload: SessionPayload) {
  const days = positiveInt(process.env.SESSION_EXPIRES_DAYS, 7, 30);
  const token = await new SignJWT({
    ...payload,
    sessionVersion: payload.sessionVersion ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secretKey("NEXTAUTH_SECRET"));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: days * 86400,
  });
}
export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let payload;
  try {
    ({ payload } = await jwtVerify(token, secretKey("NEXTAUTH_SECRET"), {
      algorithms: ["HS256"],
    }));
  } catch {
    return null;
  }
  if (
    typeof payload.userId !== "string" ||
    typeof payload.sessionVersion !== "number"
  )
    return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, phone: true, sessionVersion: true },
  });
  if (!user?.phone || user.sessionVersion !== payload.sessionVersion)
    return null;
  return {
    userId: user.id,
    phone: user.phone,
    sessionVersion: user.sessionVersion,
  };
}
export async function requireSession() {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Unauthorized");
  return session;
}
