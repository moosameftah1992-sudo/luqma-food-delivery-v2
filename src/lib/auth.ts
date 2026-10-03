import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export const MASTER_USERNAME = "moosameftah";
export const MASTER_EMAIL = "moosameftah1992@gmail.com";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "luqma_dev_secret_key_2024"
);

export async function signToken(payload: Record<string, unknown>) {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

export async function verifyToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const hashPassword = (pw: string) => bcrypt.hashSync(pw, 10);
export const checkPassword = (pw: string, hash: string) =>
  bcrypt.compareSync(pw, hash);

const ROLE_COOKIES: Record<string, string> = {
  customer: "luqma_cust",
  store: "luqma_store",
  driver: "luqma_driver",
  admin: "luqma_admin",
};

export async function setSessionCookie(role: string, id: number, name: string, extra?: Record<string, unknown>) {
  const token = await signToken({ role, id, name, ...(extra || {}) });
  const store = await cookies();
  store.set(ROLE_COOKIES[role], token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie(role: string) {
  const store = await cookies();
  store.set(ROLE_COOKIES[role], "", { maxAge: 0, path: "/" });
}

type Session = { id: number; name: string; [k: string]: unknown } | null;

export async function getSession(role: string): Promise<Session> {
  const store = await cookies();
  const payload = await verifyToken(store.get(ROLE_COOKIES[role])?.value);
  if (!payload || payload.role !== role) return null;
  return payload as Session;
}

export const getCustomer = () => getSession("customer");
export const getStoreSession = () => getSession("store");
export const getDriverSession = () => getSession("driver");
export const getAdminSession = () => getSession("admin");
