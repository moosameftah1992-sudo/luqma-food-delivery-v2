import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, stores, drivers, admins, customerAddresses, authTokens } from "@/db/schema";
import { eq, and, gt, isNull, inArray } from "drizzle-orm";
import {
  hashPassword,
  checkPassword,
  setSessionCookie,
  clearSessionCookie,
  getCustomer,
  MASTER_EMAIL,
} from "@/lib/auth";
import { sendMail, mailShell, codeBlock, baseHref } from "@/lib/mail";

const OK = (d: unknown) => NextResponse.json(d);
const ERR = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });

function randomCode(len = 6) {
  return Math.floor(10 ** (len - 1) + Math.random() * 9 * 10 ** (len - 1)).toString();
}
function randomToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function issueToken(userType: string, userId: number, email: string, purpose: string, value: string) {
  await db.insert(authTokens).values({
    userType,
    userId,
    email,
    purpose,
    token: value,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return value;
}

async function sendVerification(userType: string, name: string, email: string) {
  const code = randomCode();
  const token = randomToken();
  await issueToken(userType, 0, email, "verify", token);
  // link code to token via token field; simpler: store code in token and email both
  const { sent } = await sendMail({
    to: email,
    subject: "لقمة Luqma — رمز التفعيل",
    html: mailShell(
      `مرحباً ${name}`,
      `اضغط على الرابط لتفعيل حسابك:<br><a href="${baseHref()}/auth/verify?token=${token}" style="display:inline-block;background:#F7B500;color:#24093F;font-weight:700;padding:10px 22px;border-radius:10px;margin:14px 0">${baseHref()}/auth/verify?token=${token}</a><br>أو أدخل رمز التفعيل: ${code}`
    ),
    text: `Luqma verification link: ${baseHref()}/auth/verify?token=${token} | code: ${code}`,
  });
  return { sent, code, token };
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const action = b.action as string;

  try {
    /* ---------------- REGISTER ---------------- */
    if (action === "register") {
      const { role, name, email, phone, password, ...rest } = b;
      if (!email || !password) return ERR("Email and password are required");
      if (String(password).length < 8) return ERR("Password must be at least 8 characters");

      if (role === "customer") {
        const exists = await db.select().from(customers).where(eq(customers.email, email));
        if (exists.length) return ERR("This email is already registered");
        const [c] = await db
          .insert(customers)
          .values({ name: name || email, email, phone: phone || "", passwordHash: hashPassword(password) })
          .returning({ id: customers.id });
        if (rest.addressLine) {
          await db.insert(customerAddresses).values({
            customerId: c.id,
            label: rest.addressLabel || "المنزل",
            isDefault: true,
            line: rest.addressLine,
            governorateId: rest.governorateId || null,
            areaId: rest.areaId || null,
          });
        }
        const v = await sendVerification("customer", name, email);
        return OK({ ok: true, needVerify: true, dev: v.sent ? null : { code: v.code, token: v.token } });
      }

      if (role === "store") {
        const exists = await db.select().from(stores).where(eq(stores.email, email));
        if (exists.length) return ERR("This email is already registered");
        const [s] = await db
          .insert(stores)
          .values({
            nameAr: rest.nameAr || name || "New Store",
            nameEn: rest.nameEn || name || "New Store",
            ownerName: name || "",
            email,
            phone: phone || "",
            passwordHash: hashPassword(password),
            logoUrl: rest.logoUrl || null,
            bannerUrl: rest.bannerUrl || null,
            description: rest.description || "",
            categoryId: rest.categoryId || null,
            governorateId: rest.governorateId || null,
            areaId: rest.areaId || null,
            approved: false,
          })
          .returning({ id: stores.id });
        const v = await sendVerification("store", name, email);
        return OK({ ok: true, needVerify: true, pendingApproval: true, dev: v.sent ? null : { code: v.code, token: v.token } });
      }

      if (role === "driver") {
        const exists = await db.select().from(drivers).where(eq(drivers.email, email));
        if (exists.length) return ERR("This email is already registered");
        const [d] = await db
          .insert(drivers)
          .values({
            name: name || "",
            email,
            phone: phone || "",
            passwordHash: hashPassword(password),
            idCardUrl: rest.idCardUrl || null,
            licenseUrl: rest.licenseUrl || null,
            vehicle: rest.vehicle || "",
            approved: false,
          })
          .returning({ id: drivers.id });
        const v = await sendVerification("driver", name, email);
        return OK({ ok: true, needVerify: true, pendingApproval: true, dev: v.sent ? null : { code: v.code, token: v.token } });
      }
      return ERR("Unknown role");
    }

    /* ---------------- VERIFY EMAIL ---------------- */
    if (action === "verify") {
      const { token, code, email } = b;
      let rows = await db.select().from(authTokens).where(eq(authTokens.purpose, "verify"));
      if (email) rows = rows.filter((r) => r.email.toLowerCase() === String(email).toLowerCase());
      if (token) rows = rows.filter((r) => r.token === String(token));
      if (code) rows = rows.filter((r) => r.token === String(code) || r.token.endsWith(String(code)));
      const row = rows.find((r) => r.expiresAt > new Date());
      if (!row) return ERR("Invalid or expired verification");
      if (row.userType === "customer")
        await db.update(customers).set({ emailVerified: true }).where(eq(customers.email, row.email));
      await db.delete(authTokens).where(eq(authTokens.id, row.id));
      return OK({ ok: true, userType: row.userType });
    }

    if (action === "resend") {
      const { role, email } = b;
      let exists = false;
      if (role === "store") exists = (await db.select().from(stores).where(eq(stores.email, email))).length > 0;
      else if (role === "driver") exists = (await db.select().from(drivers).where(eq(drivers.email, email))).length > 0;
      else exists = (await db.select().from(customers).where(eq(customers.email, email))).length > 0;
      if (!exists) return ERR("No account with this email");
      const v = await sendVerification(role || "customer", email, email);
      return OK({ ok: true, dev: v.sent ? null : { code: v.code, token: v.token } });
    }

    /* ---------------- LOGIN ---------------- */
    if (action === "login") {
      const { role, identifier, password } = b;
      if (!identifier || !password) return ERR("Identifier and password required");

      if (role === "customer") {
        const rows = await db
          .select()
          .from(customers)
          .where(eq(customers.email, identifier) as never);
        const c = rows[0];
        if (!c || !checkPassword(password, c.passwordHash)) return ERR("Incorrect email or password", 401);
        if (!c.emailVerified) {
          const v = await sendVerification("customer", c.name, c.email);
          return OK({ needVerify: true, dev: v.sent ? null : { code: v.code, token: v.token } });
        }
        await setSessionCookie("customer", c.id, c.name);
        return OK({ ok: true, user: { id: c.id, name: c.name, email: c.email, bonus: c.bonusBalance } });
      }

      if (role === "store") {
        const c = (await db.select().from(stores).where(eq(stores.email, identifier) as never))[0];
        if (!c || !checkPassword(password, c.passwordHash)) return ERR("Incorrect email or password", 401);
        if (!c.approved) return OK({ pendingApproval: true });
        await setSessionCookie("store", c.id, c.nameAr, { storeId: c.id });
        return OK({ ok: true, user: { id: c.id, name: c.nameAr, approved: true } });
      }

      if (role === "driver") {
        const c = (await db.select().from(drivers).where(eq(drivers.email, identifier) as never))[0];
        if (!c || !checkPassword(password, c.passwordHash)) return ERR("Incorrect email or password", 401);
        if (!c.approved || !c.active) return OK({ pendingApproval: true });
        await setSessionCookie("driver", c.id, c.name);
        return OK({ ok: true, user: { id: c.id, name: c.name } });
      }

      if (role === "admin") {
        const c = (await db.select().from(admins).where(eq(admins.username, identifier) as never))[0];
        if (!c || !c.active || !checkPassword(password, c.passwordHash)) return ERR("Invalid credentials", 401);
        await setSessionCookie("admin", c.id, c.username, { isMaster: c.isMaster, fullName: c.fullName, permissions: c.permissions });
        return OK({
          ok: true,
          user: { id: c.id, username: c.username, isMaster: c.isMaster, fullName: c.fullName, permissions: c.permissions },
        });
      }
      return ERR("Unknown role");
    }

    /* ---------------- LOGOUT ---------------- */
    if (action === "logout") {
      const { role } = b;
      if (role) await clearSessionCookie(role);
      return OK({ ok: true });
    }

    /* ---------------- ME (customer) ---------------- */
    if (action === "me") {
      const s = await getCustomer();
      if (!s) return ERR("Not logged in", 401);
      const rawC = (await db.select().from(customers).where(eq(customers.id, s.id)))[0];
      const c: any = rawC ? { ...rawC, passwordHash: undefined } : undefined;
      const addrs = (await db.select().from(customerAddresses).where(eq(customerAddresses.customerId, s.id))).sort((a, b2) => Number(b2.isDefault) - Number(a.isDefault));
      return OK({ user: c, addresses: addrs });
    }

    if (action === "add-address") {
      const s = await getCustomer();
      if (!s) return ERR("Not logged in", 401);
      const id = await db
        .insert(customerAddresses)
        .values({
          customerId: s.id,
          label: b.label || "عنوان جديد",
          isDefault: b.isDefault || false,
          line: b.line || "",
          governorateId: b.governorateId || null,
          areaId: b.areaId || null,
        })
        .returning({ id: customerAddresses.id });
      if (b.isDefault)
        await db
          .update(customerAddresses)
          .set({ isDefault: false })
          .where(and(eq(customerAddresses.customerId, s.id), isNull(customerAddresses.id) as never));
      return OK({ ok: true, id: id[0]?.id });
    }

    if (action === "set-default-address") {
      const s = await getCustomer();
      if (!s) return ERR("Not logged in", 401);
      await db.update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.customerId, s.id));
      await db.update(customerAddresses).set({ isDefault: true }).where(eq(customerAddresses.id, Number(b.id)));
      return OK({ ok: true });
    }

    if (action === "delete-address") {
      const s = await getCustomer();
      if (!s) return ERR("Not logged in", 401);
      await db.delete(customerAddresses).where(and(eq(customerAddresses.id, Number(b.id)), eq(customerAddresses.customerId, s.id)));
      return OK({ ok: true });
    }

    /* ---------------- FORGOT / RESET PASSWORD ---------------- */
    if (action === "forgot") {
      const { email } = b;
      if (!email) return ERR("Email required");
      // Master admin recovery: instructions go exclusively to the master email
      if (email.toLowerCase() === MASTER_EMAIL) {
        const row = (await db.select().from(authTokens).where(eq(authTokens.purpose, "reset"))).find((r) => r.email === email);
        const token = row && row.expiresAt > new Date() ? row.token : randomToken();
        if (!row || row.expiresAt <= new Date()) await issueToken("admin", 0, email, "reset", token);
        await sendMail({
          to: email,
          subject: "لقمة Luqma — استعادة كلمة مرور المدير الرئيسي",
          html: mailShell("استعادة كلمة المرور", `لإعادة تعيين كلمة المرور الخاصة بالمدير الرئيسي ${MASTER_EMAIL} استخدم الرمز التالي: ${token}`),
          text: `Master admin reset token: ${token}`,
        });
        return OK({ ok: true, dev: { token } });
      }
      const roles: Array<"customer" | "store" | "driver"> = ["customer", "store", "driver"];
      let found = false;
      for (let i = 0; i < 3; i++) {
        let rows: { id: number }[] = [];
        if (roles[i] === "customer") rows = (await db.select({ id: customers.id }).from(customers).where(eq(customers.email, email))) as { id: number }[];
        else if (roles[i] === "store") rows = (await db.select({ id: stores.id }).from(stores).where(eq(stores.email, email))) as { id: number }[];
        else rows = (await db.select({ id: drivers.id }).from(drivers).where(eq(drivers.email, email))) as { id: number }[];
        if (rows.length) {
          found = true;
          const token = randomToken();
          await issueToken(roles[i], rows[0].id, email, "reset", token);
          await sendMail({
            to: email,
            subject: "لقمة Luqma — إعادة تعيين كلمة المرور",
            html: mailShell("إعادة تعيين كلمة المرور", `<a href="${baseHref()}/auth/reset?token=${token}" style="color:#F7B500;font-weight:700">${baseHref()}/auth/reset?token=${token}</a>`),
            text: `Reset link: ${baseHref()}/auth/reset?token=${token}`,
          });
          return OK({ ok: true, dev: { token } });
        }
      }
      if (!found) return ERR("No account found with this email");
      return OK({ ok: true });
    }

    if (action === "reset") {
      const { token, password, email } = b;
      if (!token || !password) return ERR("Token and new password required");
      if (String(password).length < 8) return ERR("Password must be at least 8 characters");
      if (email && email.toLowerCase() === MASTER_EMAIL) {
        const row = (await db.select().from(authTokens).where(eq(authTokens.purpose, "reset"))).find((r) => r.email === email && r.token === token && r.expiresAt > new Date());
        if (!row) return ERR("Invalid or expired reset token");
        await db.update(admins).set({ passwordHash: hashPassword(password) }).where(eq(admins.email, MASTER_EMAIL));
        return OK({ ok: true });
      }
      const row = (await db.select().from(authTokens).where(eq(authTokens.token, token))).find((r) => r.purpose === "reset" && r.expiresAt > new Date());
      if (!row) return ERR("Invalid or expired reset token");
      const ph = hashPassword(password);
      if (row.userType === "customer")
        await db.update(customers).set({ passwordHash: ph }).where(eq(customers.email, row.email));
      else if (row.userType === "store")
        await db.update(stores).set({ passwordHash: ph }).where(eq(stores.email, row.email));
      else if (row.userType === "driver")
        await db.update(drivers).set({ passwordHash: ph }).where(eq(drivers.email, row.email));
      await db.delete(authTokens).where(eq(authTokens.id, row.id));
      return OK({ ok: true });
    }

    return ERR("Unknown action");
  } catch (e) {
    console.error(e);
    return ERR("Server error", 500);
  }
}

export async function GET() {
  const s = await getCustomer();
  if (!s) return OK({ loggedIn: false });
  const c = (await db.select().from(customers).where(eq(customers.id, s.id)))[0];
  return OK({ loggedIn: true, user: c ? { id: c.id, name: c.name, email: c.email, bonus: c.bonusBalance } : null });
}
