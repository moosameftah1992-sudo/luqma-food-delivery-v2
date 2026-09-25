import crypto from "crypto";
import { cookies } from "next/headers";

export type Role = "customer" | "store" | "driver" | "admin";

export type Session = {
  role: Role;
  id: number;
  name: string;
  perms?: string[];
};

const SECRET = process.env.SESSION_SECRET || "luqma-session-secret-v1";
const COOKIE = "luqma_session";

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 32).toString("hex");
  const a = Buffer.from(test, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sign(payload: string) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function issueToken(s: Session) {
  const payload = Buffer.from(
    JSON.stringify({ ...s, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readToken(token: string | undefined | null): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data?.exp || data.exp < Date.now()) return null;
    return { role: data.role, id: data.id, name: data.name, perms: data.perms };
  } catch {
    return null;
  }
}

export async function getSession(role?: Role): Promise<Session | null> {
  const jar = await cookies();
  const s = readToken(jar.get(COOKIE)?.value);
  if (!s) return null;
  if (role && s.role !== role) return null;
  return s;
}

export async function setSession(s: Session) {
  const jar = await cookies();
  jar.set(COOKIE, issueToken(s), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Permission model for the Super Admin console. */
export const PERMISSIONS: { key: string; label: string }[] = [
  { key: "all", label: "كامل الصلاحية" },
  { key: "finance", label: "المالية والعمولات" },
  { key: "operations", label: "العمليات والتوصيل" },
  { key: "users", label: "المستخدمون والمتاجر" },
  { key: "cms", label: "المحتوى والواجهة" },
];

export function can(sess: Session | null, perm: string) {
  if (!sess || sess.role !== "admin") return false;
  const p = sess.perms || [];
  return p.includes("all") || p.includes(perm);
}

export function newVerifyToken() {
  return crypto.randomBytes(18).toString("hex");
}

export function orderCode() {
  return "LQ-" + Math.floor(100000 + Math.random() * 900000);
}

export function paymentRef() {
  return "BP" + crypto.randomBytes(5).toString("hex").toUpperCase();
}
