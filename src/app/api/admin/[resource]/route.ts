import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "@/lib/sdb";
import { can, getSession, hashPassword, newVerifyToken } from "@/lib/auth";
import { brandFrom, DEFAULTS } from "@/lib/brand";
import { num } from "@/lib/util";

type Perm = "all" | "finance" | "operations" | "users" | "cms";

export async function GET(req: Request) {
  const db = await getDb();
  const sess = await getSession("admin");
  if (!sess) return Response.json({ error: "تسجيل الدخول مطلوب" }, { status: 401 });
  const url = new URL(req.url);
  const resource = resourceOf(url);

  const need = (p: Perm) => (can(sess, p) ? null : Response.json({ error: "لا تملك صلاحية لهذه العملية" }, { status: 403 }));

  if (resource === "overview") {
    if (!can(sess, "finance") && !can(sess, "operations") && !can(sess, "users"))
      return Response.json({ error: "لا تملك صلاحية لهذه العملية" }, { status: 403 });
    const orders = await db.select().from(t.orders);
    const stores = await db.select().from(t.stores);
    const drivers = await db.select().from(t.drivers);
    const customers = await db.select().from(t.customers);
    const delivered = orders.filter((o) => o.status === "delivered");
    const gmv = delivered.reduce((s, o) => s + o.subtotalFils, 0);
    const storeCommission = delivered.reduce((s, o) => s + o.storeCommissionFils, 0);
    const deliveryCommission = delivered.reduce(
      (s, o) => s + Math.round((o.deliveryFeeFils * o.deliveryCommissionPct) / 100),
      0,
    );
    return Response.json({
      counts: {
        orders: orders.length,
        delivered: delivered.length,
        pending: orders.filter((o) => o.status === "pending").length,
        stores: stores.length,
        drivers: drivers.length,
        customers: customers.length,
        pendingStores: stores.filter((s) => !s.approved).length,
        pendingDrivers: drivers.filter((d) => d.status === "pending").length,
      },
      money: {
        gmvFils: gmv,
        deliveryFeesFils: delivered.reduce((s, o) => s + o.deliveryFeeFils, 0),
        storeCommissionFils: storeCommission,
        deliveryCommissionFils: deliveryCommission,
        totalCommissionFils: storeCommission + deliveryCommission,
      },
    });
  }

  if (resource === "settings") {
    const g = need("cms");
    if (g) return g;
    const rows = await db.select().from(t.settings);
    return Response.json({
      settings: brandFrom(rows),
      defaults: DEFAULTS,
      banners: await db.select().from(t.banners).orderBy(t.banners.sortOrder),
      pages: await db.select().from(t.cmsPages),
    });
  }

  if (resource === "locations") {
    const govs = await db.select().from(t.governorates).orderBy(t.governorates.id);
    const areas = await db.select().from(t.areas).orderBy(t.areas.id);
    return Response.json({ governorates: govs, areas });
  }

  if (resource === "customers") {
    const g = need("users");
    if (g) return g;
    const rows = await db.select().from(t.customers).orderBy(desc(t.customers.id));
    return Response.json(rows.map(({ passwordHash: _hash, verifyToken: _token, ...row }) => row));
  }

  if (resource === "stores") {
    if (!can(sess, "users") && !can(sess, "operations"))
      return Response.json({ error: "لا تملك صلاحية لهذه العملية" }, { status: 403 });
    const rows = await db.select().from(t.stores).orderBy(desc(t.stores.id));
    return Response.json(rows.map(({ passwordHash: _hash, ...row }) => row));
  }

  if (resource === "drivers") {
    const g = need("users");
    if (g) return g;
    const [driverRows, totals, paid] = await Promise.all([
      db.select().from(t.drivers).orderBy(desc(t.drivers.id)),
      db.select({
        driverId: t.orders.driverId,
        completedOrders: sql<number>`count(*)::int`,
        deliveryFeesFils: sql<number>`coalesce(sum(${t.orders.deliveryFeeFils}), 0)::int`,
        platformCommissionFils: sql<number>`coalesce(sum(round(${t.orders.deliveryFeeFils} * ${t.orders.deliveryCommissionPct} / 100.0)), 0)::int`,
      }).from(t.orders).where(and(eq(t.orders.status, "delivered"), eq(t.orders.paymentStatus, "captured"))).groupBy(t.orders.driverId),
      db.select({ driverId: t.payouts.driverId, paidFils: sql<number>`coalesce(sum(${t.payouts.amountFils}), 0)::int` }).from(t.payouts).groupBy(t.payouts.driverId),
    ]);
    return Response.json(driverRows.map(({ passwordHash: _hash, verifyToken: _token, ...row }) => {
      const summary = totals.find((entry) => entry.driverId === row.id);
      const deliveryFeesFils = summary?.deliveryFeesFils ?? 0;
      const platformCommissionFils = summary?.platformCommissionFils ?? 0;
      return {
        ...row,
        completedOrders: summary?.completedOrders ?? 0,
        deliveryFeesFils,
        platformCommissionFils,
        driverNetFils: deliveryFeesFils - platformCommissionFils,
        paidFils: paid.find((entry) => entry.driverId === row.id)?.paidFils ?? 0,
      };
    }));
  }

  if (resource === "admins") {
    if (!can(sess, "all")) return Response.json({ error: "كامل الصلاحية مطلوبة" }, { status: 403 });
    const rows = await db.select().from(t.admins).orderBy(desc(t.admins.id));
    return Response.json(rows.map((r) => ({ ...r, passwordHash: undefined })));
  }

  if (resource === "price-requests") {
    const g = need("operations");
    if (g) return g;
    const rows = await db
      .select({
        req: t.priceRequests,
        storeName: t.stores.nameAr,
      })
      .from(t.priceRequests)
      .leftJoin(t.stores, eq(t.priceRequests.storeId, t.stores.id))
      .orderBy(desc(t.priceRequests.id));
    return Response.json(rows.map((r) => ({ ...r.req, storeName: r.storeName })));
  }

  if (resource === "payouts") {
    const g = need("finance");
    if (g) return g;
    const rows = await db
      .select({ payout: t.payouts, driverName: t.drivers.name })
      .from(t.payouts)
      .leftJoin(t.drivers, eq(t.payouts.driverId, t.drivers.id))
      .orderBy(desc(t.payouts.id));
    return Response.json(rows.map((r) => ({ ...r.payout, driverName: r.driverName })));
  }

  if (resource === "finance") {
    const g = need("finance");
    if (g) return g;
    const orders = await db
      .select({
        order: t.orders,
        storeName: t.stores.nameAr,
        driverName: t.drivers.name,
        storeCommission: t.stores.commissionFils,
      })
      .from(t.orders)
      .leftJoin(t.stores, eq(t.orders.storeId, t.stores.id))
      .leftJoin(t.drivers, eq(t.orders.driverId, t.drivers.id))
      .orderBy(desc(t.orders.placedAt))
      .limit(500);
    return Response.json(
      orders.map((r) => {
        const del = r.order.status === "delivered";
        const sc = num(r.storeCommission, 500);
        const deliveryCut = Math.round((r.order.deliveryFeeFils * r.order.deliveryCommissionPct) / 100);
        return {
          ...r.order,
          storeName: r.storeName,
          driverName: r.driverName,
          storeCommissionFils: del ? sc : 0,
          deliveryCommissionFils: del ? deliveryCut : 0,
          platformRevenueFils: del ? sc + deliveryCut : 0,
          storeNetFils: del ? r.order.subtotalFils - r.order.discountFils - sc : 0,
          driverNetFils: del ? r.order.deliveryFeeFils - deliveryCut : 0,
        };
      }),
    );
  }

  return Response.json({ error: "مورد غير معروف" }, { status: 404 });
}

export async function POST(req: Request) {
  const db = await getDb();
  const sess = await getSession("admin");
  if (!sess) return Response.json({ error: "تسجيل الدخول مطلوب" }, { status: 401 });
  const url = new URL(req.url);
  const resource = resourceOf(url);
  const body = await req.json().catch(() => ({}));
  const need = (p: Perm) => (can(sess, p) ? null : Response.json({ error: "لا تملك صلاحية لهذه العملية" }, { status: 403 }));

  if (resource === "settings") {
    const g = need("cms");
    if (g) return g;
    const entries = Object.entries((body.settings ?? {}) as Record<string, string>);
    const logoUrl = String((body.settings ?? {}).logoUrl ?? "");
    if (logoUrl && !(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logoUrl) && logoUrl.length < 1_100_000) && !(/^https:\/\//.test(logoUrl) && logoUrl.length < 600))
      return Response.json({ error: "رابط الشعار أو صيغة الصورة غير صالحة" }, { status: 400 });
    for (const [key, value] of entries) {
      await db
        .insert(t.settings)
        .values({ key, value: String(value ?? "") })
        .onConflictDoUpdate({ target: t.settings.key, set: { value: String(value ?? "") } });
    }
    if (body.banners) {
      await db.delete(t.banners);
      if (Array.isArray(body.banners) && body.banners.length)
        await db.insert(t.banners).values(
          body.banners.map((b: { image: string; titleAr: string; titleEn?: string; subtitleAr: string; subtitleEn?: string }, i: number) => ({
            image: String(b.image || "/images/hero-feast.jpg"),
            titleAr: String(b.titleAr || ""),
            titleEn: String(b.titleEn || ""),
            subtitleAr: String(b.subtitleAr || ""),
            subtitleEn: String(b.subtitleEn || ""),
            sortOrder: i,
          })),
        );
    }
    if (body.pages) {
      await db.delete(t.cmsPages);
      if (Array.isArray(body.pages) && body.pages.length)
        await db.insert(t.cmsPages).values(
          body.pages.map((p: { slug: string; titleAr: string; titleEn?: string; bodyAr: string; bodyEn?: string }) => ({
            slug: String(p.slug || "page"),
            titleAr: String(p.titleAr || ""),
            titleEn: String(p.titleEn || ""),
            bodyAr: String(p.bodyAr || ""),
            bodyEn: String(p.bodyEn || ""),
          })),
        );
    }
    return Response.json({ ok: true });
  }

  if (resource === "locations") {
    const g = need("operations");
    if (g) return g;
    const nameAr = String(body.nameAr || "").trim();
    const nameEn = String(body.nameEn || "").trim();
    if (!nameAr || !nameEn) return Response.json({ error: "أدخل الاسمين العربي والإنجليزي" }, { status: 400 });
    if (body.kind === "governorate") {
      const [r] = await db.insert(t.governorates).values({ nameAr, nameEn, active: body.active !== false }).returning();
      return Response.json(r);
    }
    const governorateId = Number(body.governorateId);
    const deliveryFeeFils = Number(body.deliveryFeeFils);
    const [gov] = await db.select({ id: t.governorates.id }).from(t.governorates).where(eq(t.governorates.id, governorateId)).limit(1);
    if (!gov || !Number.isInteger(deliveryFeeFils) || deliveryFeeFils < 0 || deliveryFeeFils > 30000)
      return Response.json({ error: "اختر محافظة ورسوم توصيل صالحة" }, { status: 400 });
    const [r] = await db.insert(t.areas).values({ governorateId, nameAr, nameEn, deliveryFeeFils, active: body.active !== false }).returning();
    return Response.json(r);
  }

  if (resource === "stores") {
    const g = need("users");
    if (g) return g;
    const password = String(body.password || "");
    const email = String(body.email || "").trim().toLowerCase();
    const nameAr = String(body.nameAr || "").trim();
    const nameEn = String(body.nameEn || "").trim();
    const areaId = Number(body.areaId);
    if (password.length < 12 || !nameAr || !nameEn || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return Response.json({ error: "اسم المتجر باللغتين وبريد صحيح وكلمة مرور قوية (12 حرفاً) مطلوبة" }, { status: 400 });
    const [area] = await db.select({ id: t.areas.id }).from(t.areas).where(eq(t.areas.id, areaId)).limit(1);
    if (!area) return Response.json({ error: "اختر منطقة صالحة للمتجر" }, { status: 400 });
    const [dupe] = await db.select({ id: t.stores.id }).from(t.stores).where(eq(t.stores.email, email)).limit(1);
    if (dupe) return Response.json({ error: "البريد مسجّل لمتجر آخر" }, { status: 409 });
    const [r] = await db.insert(t.stores).values({
      nameAr, nameEn, email, phone: String(body.phone || "").trim(),
      passwordHash: hashPassword(password),
      cuisine: String(body.cuisine || "مطعم").trim(), description: String(body.description || "").trim(),
      image: String(body.image || "/images/store-front.jpg"), areaId,
      address: String(body.address || "").trim(), approved: false,
      commissionFils: num(body.commissionFils, 500),
    }).returning();
    return Response.json({ store: { ...r, passwordHash: undefined }, credentials: { email, password } }, { status: 201 });
  }

  if (resource === "drivers") {
    const g = need("finance");
    if (g) return g;
    const [r] = await db
      .insert(t.payouts)
      .values({
        driverId: num(body.driverId),
        amountFils: num(body.amountFils),
        note: String(body.note || ""),
      })
      .returning();
    return Response.json(r);
  }

  if (resource === "admins") {
    if (!can(sess, "all")) return Response.json({ error: "كامل الصلاحية مطلوبة" }, { status: 403 });
    const username = String(body.username || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username))
      return Response.json({ error: "اسم المستخدم 3–32 حرفاً إنجليزياً أو رقماً" }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return Response.json({ error: "أدخل بريداً إلكترونياً إدارياً صالحاً" }, { status: 400 });
    if (password.length < 12)
      return Response.json({ error: "كلمة مرور المدير يجب أن تكون 12 حرفاً على الأقل" }, { status: 400 });
    const [existing] = await db
      .select({ id: t.admins.id })
      .from(t.admins)
      .where(or(eq(t.admins.username, username), eq(t.admins.email, email)))
      .limit(1);
    if (existing) return Response.json({ error: "اسم المستخدم أو البريد مسجّل مسبقاً" }, { status: 409 });
    const [r] = await db
      .insert(t.admins)
      .values({
        username,
        email,
        passwordHash: hashPassword(password),
        fullName: String(body.fullName || ""),
        title: String(body.title || "مدير"),
        permissions: Array.isArray(body.permissions) ? body.permissions : ["operations"],
      })
      .returning();
    return Response.json({ ...r, passwordHash: undefined });
  }

  if (resource === "price-requests") {
    const g = need("operations");
    if (g) return g;
    const id = num(body.id);
    const status = body.status === "approved" ? "approved" : "rejected";
    const [reqRow] = await db.select().from(t.priceRequests).where(eq(t.priceRequests.id, id));
    if (!reqRow) return Response.json({ error: "الطلب غير موجود" }, { status: 404 });
    await db
      .update(t.priceRequests)
      .set({ status, adminNote: String(body.adminNote || "") })
      .where(eq(t.priceRequests.id, id));
    if (status === "approved" && reqRow.itemId) {
      if (reqRow.target === "size" && reqRow.sizeId) {
        await db
          .update(t.itemSizes)
          .set({ priceFils: reqRow.newPriceFils })
          .where(eq(t.itemSizes.id, reqRow.sizeId));
      } else {
        await db
          .update(t.items)
          .set({ priceFils: reqRow.newPriceFils })
          .where(eq(t.items.id, reqRow.itemId));
      }
    }
    return Response.json({ ok: true, status });
  }

  if (resource === "customers" || resource === "drivers" || resource === "banners" || resource === "pages") {
    return Response.json({ error: "استخدم مسار التحديث" }, { status: 400 });
  }

  return Response.json({ error: "مورد غير معروف" }, { status: 404 });
}

function resourceOf(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1];
}
