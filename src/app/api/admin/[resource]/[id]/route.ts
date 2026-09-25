import { eq } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "@/lib/sdb";
import { can, getSession, hashPassword } from "@/lib/auth";
import { num } from "@/lib/util";

type Ctx = { params: Promise<{ resource: string; id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { resource, id } = await ctx.params;
  const db = await getDb();
  const sess = await getSession("admin");
  if (!sess) return Response.json({ error: "تسجيل الدخول مطلوب" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const rowId = Number(id);
  const usersOnly = Response.json({ error: "لا تملك صلاحية لهذه العملية" }, { status: 403 });

  if (resource === "customers") {
    if (!can(sess, "users") && !can(sess, "all")) return usersOnly;
    if (body.password !== undefined && (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 128))
      return Response.json({ error: "كلمة مرور العميل يجب أن تكون بين 12 و128 حرفاً" }, { status: 400 });
    const [u] = await db
      .update(t.customers)
      .set({
        name: body.name !== undefined ? String(body.name) : undefined,
        phone: body.phone !== undefined ? String(body.phone) : undefined,
        address: body.address !== undefined ? String(body.address) : undefined,
        emailVerified: body.emailVerified !== undefined ? Boolean(body.emailVerified) : undefined,
        status: body.status !== undefined ? String(body.status) : undefined,
        passwordHash: body.password !== undefined ? hashPassword(body.password) : undefined,
      })
      .where(eq(t.customers.id, rowId))
      .returning();
    if (!u) return Response.json({ error: "العميل غير موجود" }, { status: 404 });
    const { passwordHash: _passwordHash, verifyToken: _verifyToken, ...safeCustomer } = u;
    return Response.json(safeCustomer);
  }

  if (resource === "stores") {
    if (!can(sess, "users") && !can(sess, "all")) return usersOnly;
    const [u] = await db
      .update(t.stores)
      .set({
        nameAr: body.nameAr !== undefined ? String(body.nameAr) : undefined,
        cuisine: body.cuisine !== undefined ? String(body.cuisine) : undefined,
        description: body.description !== undefined ? String(body.description) : undefined,
        status: body.status !== undefined ? String(body.status) : undefined,
        approved: body.approved !== undefined ? Boolean(body.approved) : undefined,
        banned: body.banned !== undefined ? Boolean(body.banned) : undefined,
        commissionFils: body.commissionFils !== undefined ? num(body.commissionFils) : undefined,
        minOrderFils: body.minOrderFils !== undefined ? num(body.minOrderFils) : undefined,
        passwordHash: body.password ? hashPassword(String(body.password)) : undefined,
      })
      .where(eq(t.stores.id, rowId))
      .returning();
    return Response.json(u);
  }

  if (resource === "drivers") {
    if (!can(sess, "users") && !can(sess, "all")) return usersOnly;
    if (body.status === "active") {
      const [driver] = await db.select({ verified: t.drivers.emailVerified }).from(t.drivers).where(eq(t.drivers.id, rowId)).limit(1);
      const [docs] = await db.select({ id: t.driverDocuments.driverId }).from(t.driverDocuments).where(eq(t.driverDocuments.driverId, rowId)).limit(1);
      if (!driver?.verified || !docs) return Response.json({ error: "لا يمكن اعتماد المندوب قبل تأكيد البريد ومراجعة وثائق الهوية والرخصة" }, { status: 409 });
    }
    const [u] = await db
      .update(t.drivers)
      .set({
        name: body.name !== undefined ? String(body.name) : undefined,
        phone: body.phone !== undefined ? String(body.phone) : undefined,
        status: body.status !== undefined ? String(body.status) : undefined,
        commissionPct: body.commissionPct !== undefined ? Math.max(0, Math.min(100, num(body.commissionPct))) : undefined,
        online: body.status === "banned" || body.status === "terminated" ? false : undefined,
      })
      .where(eq(t.drivers.id, rowId))
      .returning();
    return Response.json(u ? { ...u, passwordHash: undefined, verifyToken: undefined } : { error: "غير موجود" }, { status: u ? 200 : 404 });
  }

  if (resource === "admins") {
    if (!can(sess, "all")) return Response.json({ error: "كامل الصلاحية مطلوبة" }, { status: 403 });
    let email: string | undefined;
    if (body.email !== undefined) {
      email = String(body.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return Response.json({ error: "أدخل بريداً إلكترونياً إدارياً صالحاً" }, { status: 400 });
      const [existing] = await db
        .select({ id: t.admins.id })
        .from(t.admins)
        .where(eq(t.admins.email, email))
        .limit(1);
      if (existing && existing.id !== rowId)
        return Response.json({ error: "البريد مسجّل لمدير آخر" }, { status: 409 });
    }
    if (body.password && String(body.password).length < 12)
      return Response.json({ error: "كلمة مرور المدير يجب أن تكون 12 حرفاً على الأقل" }, { status: 400 });
    const [u] = await db
      .update(t.admins)
      .set({
        email,
        fullName: body.fullName !== undefined ? String(body.fullName) : undefined,
        title: body.title !== undefined ? String(body.title) : undefined,
        status: body.status !== undefined ? String(body.status) : undefined,
        permissions: Array.isArray(body.permissions) ? body.permissions : undefined,
        passwordHash: body.password ? hashPassword(String(body.password)) : undefined,
      })
      .where(eq(t.admins.id, rowId))
      .returning();
    if (!u) return Response.json({ error: "حساب المدير غير موجود" }, { status: 404 });
    return Response.json({ ...u, passwordHash: undefined });
  }

  if (resource === "locations") {
    if (!can(sess, "operations") && !can(sess, "all")) return usersOnly;
    const nameAr = body.nameAr !== undefined ? String(body.nameAr).trim() : undefined;
    const nameEn = body.nameEn !== undefined ? String(body.nameEn).trim() : undefined;
    if (nameAr !== undefined && !nameAr) return Response.json({ error: "الاسم العربي مطلوب" }, { status: 400 });
    if (nameEn !== undefined && !nameEn) return Response.json({ error: "الاسم الإنجليزي مطلوب" }, { status: 400 });
    if (body.kind === "governorate") {
      const [u] = await db.update(t.governorates).set({ nameAr, nameEn, active: body.active !== undefined ? Boolean(body.active) : undefined }).where(eq(t.governorates.id, rowId)).returning();
      return Response.json(u || { error: "المحافظة غير موجودة" }, { status: u ? 200 : 404 });
    }
    const fee = body.deliveryFeeFils === undefined ? undefined : Number(body.deliveryFeeFils);
    if (fee !== undefined && (!Number.isInteger(fee) || fee < 0 || fee > 30000)) return Response.json({ error: "رسوم التوصيل غير صالحة" }, { status: 400 });
    let governorateId: number | undefined;
    if (body.governorateId !== undefined) {
      governorateId = Number(body.governorateId);
      const [gov] = await db.select({ id: t.governorates.id }).from(t.governorates).where(eq(t.governorates.id, governorateId)).limit(1);
      if (!gov) return Response.json({ error: "المحافظة غير موجودة" }, { status: 400 });
    }
    const [u] = await db.update(t.areas).set({ nameAr, nameEn, governorateId, deliveryFeeFils: fee, active: body.active !== undefined ? Boolean(body.active) : undefined }).where(eq(t.areas.id, rowId)).returning();
    return Response.json(u || { error: "المنطقة غير موجودة" }, { status: u ? 200 : 404 });
  }

  return Response.json({ error: "مورد غير معروف" }, { status: 404 });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { resource, id } = await ctx.params;
  const db = await getDb();
  const sess = await getSession("admin");
  if (!sess) return Response.json({ error: "تسجيل الدخول مطلوب" }, { status: 401 });
  const rowId = Number(id);
  const guard = can(sess, "all") || can(sess, "users");
  if (!guard && resource !== "locations") return Response.json({ error: "لا تملك صلاحية" }, { status: 403 });

  if (resource === "locations") {
    if (!can(sess, "operations") && !can(sess, "all"))
      return Response.json({ error: "لا تملك صلاحية" }, { status: 403 });
    if (new URL(_req.url).searchParams.get("kind") === "governorate") {
      await db.delete(t.governorates).where(eq(t.governorates.id, rowId));
    } else {
      await db.delete(t.areas).where(eq(t.areas.id, rowId));
    }
    return Response.json({ ok: true });
  }

  switch (resource) {
    case "customers":
      await db.delete(t.customers).where(eq(t.customers.id, rowId));
      break;
    case "stores":
      await db.delete(t.stores).where(eq(t.stores.id, rowId));
      break;
    case "drivers":
      await db.delete(t.drivers).where(eq(t.drivers.id, rowId));
      break;
    case "admins":
      if (!can(sess, "all"))
        return Response.json({ error: "كامل الصلاحية مطلوبة" }, { status: 403 });
      await db.delete(t.admins).where(eq(t.admins.id, rowId));
      break;
    case "payouts":
      await db.delete(t.payouts).where(eq(t.payouts.id, rowId));
      break;
    default:
      return Response.json({ error: "مورد غير معروف" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
