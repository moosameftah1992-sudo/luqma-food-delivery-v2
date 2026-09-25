import { and, eq, gt, or } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "@/lib/sdb";
import { createVerification, digestToken, mailConfigurationIssue, sendVerificationMail } from "@/lib/mail";
import { clearSession, hashPassword, setSession, verifyPassword, type Role, type Session } from "@/lib/auth";

export const runtime = "nodejs";
const ROLES: Role[] = ["customer", "store", "driver", "admin"];
type Ctx = { params: Promise<{ role: string; action: string }> };
const json = (value: unknown, status = 200) => Response.json(value, { status });

function isDocument(data: unknown): data is string {
  if (typeof data !== "string" || data.length > 1_350_000 || data.length < 100) return false;
  const match = /^data:(image\/jpeg|image\/png|image\/webp|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(data);
  return Boolean(match && match[2].length <= 1_300_000 && match[2].length % 4 === 0);
}

export async function POST(req: Request, ctx: Ctx) {
  const { role, action } = await ctx.params;
  if (!ROLES.includes(role as Role)) return json({ error: "دور غير معروف" }, 400);
  const R = role as Role;
  if (action === "logout") { await clearSession(); return json({ ok: true }); }
  const db = await getDb();
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "البيانات المرسلة غير صالحة" }, 400); }

  if (action === "login") {
    const identifier = String(role === "admin" ? body.username ?? "" : body.email ?? "").trim();
    const password = String(body.password || "");
    if (!identifier || !password) return json({ error: "أكمل البيانات المطلوبة" }, 400);
    if (role === "customer") {
      const [u] = await db.select().from(t.customers).where(eq(t.customers.email, identifier.toLowerCase())).limit(1);
      if (!u || !verifyPassword(password, u.passwordHash)) return json({ error: "بيانات الدخول غير صحيحة" }, 401);
      if (u.status === "banned") return json({ error: "هذا الحساب موقوف" }, 403);
      if (!u.emailVerified || u.status !== "active") return json({ error: "يرجى تأكيد بريدك الإلكتروني أولاً. تحقق من بريدك الوارد أو أعد إرسال الرابط.", needsVerification: true }, 403);
      await setSession({ role: R, id: u.id, name: u.name });
      return json({ ok: true, name: u.name });
    }
    if (role === "driver") {
      const [u] = await db.select().from(t.drivers).where(eq(t.drivers.email, identifier.toLowerCase())).limit(1);
      if (!u || !verifyPassword(password, u.passwordHash)) return json({ error: "بيانات الدخول غير صحيحة" }, 401);
      if (u.status === "banned" || u.status === "terminated") return json({ error: "الحساب موقوف" }, 403);
      if (!u.emailVerified) return json({ error: "أكد بريدك الإلكتروني أولاً. يمكنك طلب رابط جديد.", needsVerification: true }, 403);
      if (u.status !== "active") return json({ error: "تم تأكيد بريدك، وحسابك قيد مراجعة إدارة لقمة حتى الموافقة النهائية.", pending: true }, 403);
      await setSession({ role: R, id: u.id, name: u.name });
      return json({ ok: true, name: u.name, online: u.online });
    }
    if (role === "store") {
      const [u] = await db.select().from(t.stores).where(eq(t.stores.email, identifier.toLowerCase())).limit(1);
      if (!u || !verifyPassword(password, u.passwordHash)) return json({ error: "بيانات الدخول غير صحيحة" }, 401);
      if (u.banned || !u.approved) return json({ error: "الحساب غير مفعل من إدارة لقمة" }, 403);
      await setSession({ role: R, id: u.id, name: u.nameAr });
      return json({ ok: true, name: u.nameAr, status: u.status });
    }
    const [u] = await db.select().from(t.admins).where(or(eq(t.admins.username, identifier), eq(t.admins.email, identifier.toLowerCase()))).limit(1);
    if (!u || !verifyPassword(password, u.passwordHash)) return json({ error: "اسم المستخدم أو البريد الإداري أو كلمة المرور غير صحيحة" }, 401);
    if (u.status !== "active") return json({ error: "حساب المدير موقوف" }, 403);
    const sess: Session = { role: R, id: u.id, name: u.fullName, perms: u.permissions ?? [] };
    await setSession(sess);
    return json({ ok: true, name: u.fullName, perms: u.permissions });
  }

  if (action === "register") {
    if (role !== "customer" && role !== "driver") return json({ error: "تُنشأ حسابات المتاجر والإدارة من لوحة الأدمن فقط" }, 403);
    const mailIssue = mailConfigurationIssue();
    if (mailIssue) return json({ error: mailIssue }, 503);
    const name = String(body.name || "").trim().slice(0, 120);
    const email = String(body.email || "").toLowerCase().trim();
    const phone = String(body.phone || "").replace(/[^+\d]/g, "").slice(0, 22);
    const password = String(body.password || "");
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || phone.length < 8)
      return json({ error: "أدخل الاسم والبريد ورقم الهاتف وكلمة مرور من 10 أحرف على الأقل" }, 400);
    const verification = createVerification();
    if (role === "customer") {
      const areaId = Number(body.areaId);
      const [area] = await db.select().from(t.areas).where(and(eq(t.areas.id, areaId), eq(t.areas.active, true))).limit(1);
      if (!area) return json({ error: "اختر منطقة توصيل صالحة" }, 400);
      const [duplicate] = await db.select({ id: t.customers.id }).from(t.customers).where(eq(t.customers.email, email)).limit(1);
      if (duplicate) return json({ error: "البريد مسجل مسبقاً. اطلب إعادة إرسال رابط التأكيد إذا لم يصلك." }, 409);
      const [u] = await db.insert(t.customers).values({ name, email, phone, passwordHash: hashPassword(password), areaId, address: String(body.address || "").slice(0, 300), emailVerified: false, status: "pending_email", verifyToken: verification.digest, verifyExpiresAt: verification.expiresAt }).returning();
      try { await sendVerificationMail({ email, name, role: "customer", token: verification.token }); }
      catch (error) { console.error("[luqma] customer email failed", error); await db.delete(t.customers).where(eq(t.customers.id, u.id)); return json({ error: "تعذر إرسال البريد. حاول مجدداً بعد قليل." }, 503); }
      await db.update(t.customers).set({ verifySentAt: new Date() }).where(eq(t.customers.id, u.id));
      return json({ ok: true, message: "أرسلنا رابط تأكيد رسمي إلى بريدك. افتحه لتفعيل الحساب." }, 201);
    }
    if (body.terms !== true || !String(body.idCardNumber || "").trim() || !String(body.licenseNumber || "").trim()) return json({ error: "رقم الهوية ورخصة القيادة والموافقة على الشروط مطلوبة" }, 400);
    if (!isDocument(body.idCardData) || !isDocument(body.licenseData)) return json({ error: "أرفق صورتَي الهوية والرخصة (JPG/PNG/WEBP/PDF، أقل من 1 م.ب للملف)" }, 400);
    const [duplicate] = await db.select({ id: t.drivers.id }).from(t.drivers).where(eq(t.drivers.email, email)).limit(1);
    if (duplicate) return json({ error: "البريد مسجل مسبقاً. اطلب إعادة إرسال رابط التأكيد إذا لم يصلك." }, 409);
    const [u] = await db.insert(t.drivers).values({ name, email, phone, passwordHash: hashPassword(password), idCardNumber: String(body.idCardNumber).trim().slice(0, 40), licenseNumber: String(body.licenseNumber).trim().slice(0, 50), termsAccepted: true, emailVerified: false, status: "pending_email", verifyToken: verification.digest, verifyExpiresAt: verification.expiresAt }).returning();
    try {
      await db.insert(t.driverDocuments).values({ driverId: u.id, idCardData: body.idCardData, licenseData: body.licenseData });
      await sendVerificationMail({ email, name, role: "driver", token: verification.token });
    } catch (error) { console.error("[luqma] driver email failed", error); await db.delete(t.drivers).where(eq(t.drivers.id, u.id)); return json({ error: "تعذر إرسال البريد. حاول مجدداً بعد قليل." }, 503); }
    await db.update(t.drivers).set({ verifySentAt: new Date() }).where(eq(t.drivers.id, u.id));
    return json({ ok: true, message: "أُرسل رابط التحقق لبريدك. بعد تأكيده ستراجع الإدارة وثائقك." }, 201);
  }

  if (action === "resend" && (role === "customer" || role === "driver")) {
    const mailIssue = mailConfigurationIssue();
    if (mailIssue) return json({ error: mailIssue }, 503);
    const email = String(body.email || "").toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "أدخل بريداً إلكترونياً صالحاً" }, 400);
    const generic = { ok: true, message: "إذا كان الحساب بانتظار التحقق فستصلك رسالة جديدة قريباً." };
    if (role === "customer") {
      const [u] = await db.select().from(t.customers).where(eq(t.customers.email, email)).limit(1);
      if (!u || u.emailVerified) return json(generic);
      if (u.verifySentAt && Date.now() - u.verifySentAt.getTime() < 90_000) return json({ error: "انتظر 90 ثانية قبل إعادة الإرسال" }, 429);
      const v = createVerification();
      await db.update(t.customers).set({ verifyToken: v.digest, verifyExpiresAt: v.expiresAt, verifySentAt: new Date() }).where(eq(t.customers.id, u.id));
      try { await sendVerificationMail({ email, name: u.name, role: "customer", token: v.token }); } catch { await db.update(t.customers).set({ verifySentAt: null }).where(eq(t.customers.id, u.id)); return json({ error: "تعذر إرسال البريد حالياً" }, 503); }
      return json(generic);
    }
    const [u] = await db.select().from(t.drivers).where(eq(t.drivers.email, email)).limit(1);
    if (!u || u.emailVerified) return json(generic);
    if (u.verifySentAt && Date.now() - u.verifySentAt.getTime() < 90_000) return json({ error: "انتظر 90 ثانية قبل إعادة الإرسال" }, 429);
    const v = createVerification();
    await db.update(t.drivers).set({ verifyToken: v.digest, verifyExpiresAt: v.expiresAt, verifySentAt: new Date() }).where(eq(t.drivers.id, u.id));
    try { await sendVerificationMail({ email, name: u.name, role: "driver", token: v.token }); } catch { await db.update(t.drivers).set({ verifySentAt: null }).where(eq(t.drivers.id, u.id)); return json({ error: "تعذر إرسال البريد حالياً" }, 503); }
    return json(generic);
  }

  if (action === "verify" && (role === "customer" || role === "driver")) {
    const token = String(body.token || "");
    if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: "رابط التحقق غير صالح" }, 400);
    const digest = digestToken(token);
    if (role === "customer") {
      const [u] = await db.update(t.customers).set({ emailVerified: true, status: "active", verifyToken: null, verifyExpiresAt: null, verifySentAt: null }).where(and(eq(t.customers.verifyToken, digest), gt(t.customers.verifyExpiresAt, new Date()), eq(t.customers.emailVerified, false), eq(t.customers.status, "pending_email"))).returning({ id: t.customers.id });
      if (!u) return json({ error: "الرابط منتهي الصلاحية أو مستخدم مسبقاً. اطلب رابطاً جديداً." }, 400);
      return json({ ok: true, message: "تم تفعيل حسابك. يمكنك تسجيل الدخول الآن." });
    }
    const [u] = await db.update(t.drivers).set({ emailVerified: true, status: "pending", verifyToken: null, verifyExpiresAt: null, verifySentAt: null }).where(and(eq(t.drivers.verifyToken, digest), gt(t.drivers.verifyExpiresAt, new Date()), eq(t.drivers.emailVerified, false), eq(t.drivers.status, "pending_email"))).returning({ id: t.drivers.id });
    if (!u) return json({ error: "الرابط منتهي الصلاحية أو مستخدم مسبقاً. اطلب رابطاً جديداً." }, 400);
    return json({ ok: true, message: "تأكد بريدك بنجاح. حساب المندوب قيد مراجعة الإدارة ولن يعمل إلا بعد الموافقة." });
  }
  return json({ error: "إجراء غير معروف" }, 404);
}

export async function GET() { return json({ error: "افتح رابط التأكيد ثم اضغط زر التفعيل" }, 405); }
