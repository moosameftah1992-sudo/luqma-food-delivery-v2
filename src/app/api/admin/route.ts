import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  admins,
  customers,
  stores,
  drivers,
  orders,
  orderItems,
  governorates,
  areas,
  cancelledOrdersLog,
  categories,
} from "@/db/schema";
import { eq, and, desc, sql, inArray, isNull } from "drizzle-orm";
import { getAdminSession, hashPassword, MASTER_EMAIL, MASTER_USERNAME } from "@/lib/auth";
import { getAllSettings, setSetting } from "@/lib/settings";

const OK = (d: unknown) => NextResponse.json(d);
const ERR = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });

const MASTER_ONLY = new Set([
  "admins", "admin-create", "admin-update", "admin-reset-password", "admin-delete",
  "settings-set",
]);

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return ERR("Unauthorized", 401);
  const b = await req.json();
  const action = String(b.action || "");
  const isMaster = !!admin.isMaster;
  if (MASTER_ONLY.has(action) && !isMaster) return ERR("Master admin only", 403);

  try {
    if (action === "me-admin") {
      return OK({ admin: { id: admin.id, username: admin.name, isMaster: !!admin.isMaster, fullName: admin.fullName, permissions: (admin.permissions as string[]) || [] } });
    }

    if (action === "dashboard") {
      const [sc] = await db.select({ n: sql<number>`count(*)::int` }).from(stores);
      const [pc] = await db.select({ n: sql<number>`count(*)::int` }).from(stores).where(eq(stores.approved, false));
      const [dc] = await db.select({ n: sql<number>`count(*)::int` }).from(drivers);
      const [dp] = await db.select({ n: sql<number>`count(*)::int` }).from(drivers).where(eq(drivers.approved, false));
      const [cc] = await db.select({ n: sql<number>`count(*)::int` }).from(customers);
      const [oc] = await db.select({ n: sql<number>`count(*)::int` }).from(orders);
      const [op] = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, "pending"));
      const [rev] = await db.select({ s: sql<number>`coalesce(sum(${orders.total})::float, 0)` }).from(orders).where(eq(orders.status, "delivered"));
      const recent = (await db.select().from(orders).orderBy(desc(orders.placedAt)).limit(8));
      const storeRows = await db.select().from(stores);
      const sm = new Map(storeRows.map((s) => [s.id, s.nameAr]));
      return OK({
        counts: {
          stores: sc.n, pendingStores: pc.n, drivers: dc.n, pendingDrivers: dp.n,
          customers: cc.n, orders: oc.n, pendingOrders: op.n, deliveredRevenue: Number(rev.s || 0),
        },
        recent: recent.map((o) => ({ ...o, storeName: sm.get(o.storeId) || "#" + o.storeId })),
      });
    }

    /* ---------------- APPROVALS & MASTER CONTROL ---------------- */
    if (action === "store-approve") {
      await db.update(stores).set({ approved: !!b.approve }).where(eq(stores.id, Number(b.id)));
      return OK({ ok: true });
    }
    if (action === "store-toggle-active") {
      await db.update(stores).set({ approved: false }).where(eq(stores.id, Number(b.id)));
      return OK({ ok: true });
    }
    if (action === "store-delete") {
      await db.delete(stores).where(eq(stores.id, Number(b.id)));
      return OK({ ok: true });
    }
    if (action === "driver-approve") {
      await db.update(drivers).set({ approved: !!b.approve }).where(eq(drivers.id, Number(b.id)));
      return OK({ ok: true });
    }
    if (action === "driver-set-active") {
      await db.update(drivers).set({ active: !!b.active }).where(eq(drivers.id, Number(b.id)));
      return OK({ ok: true });
    }
    if (action === "driver-delete") {
      await db.delete(drivers).where(eq(drivers.id, Number(b.id)));
      return OK({ ok: true });
    }
    if (action === "customer-add-bonus") {
      const c = (await db.select().from(customers).where(eq(customers.id, Number(b.id))))[0];
      if (!c) return ERR("Customer not found", 404);
      const next = Number(c.bonusBalance) + Number(b.amount);
      await db.update(customers).set({ bonusBalance: next.toFixed(2) }).where(eq(customers.id, c.id));
      return OK({ ok: true, bonus: next.toFixed(2) });
    }
    if (action === "customer-set-verified") {
      await db.update(customers).set({ emailVerified: !!b.verified }).where(eq(customers.id, Number(b.id)));
      return OK({ ok: true });
    }
    if (action === "customer-delete") {
      await db.delete(customers).where(eq(customers.id, Number(b.id)));
      return OK({ ok: true });
    }

    if (action === "stores-admin") {
      const rows = await db.select().from(stores).orderBy(desc(stores.id));
      return OK({ stores: rows.map(({ passwordHash, ...rest }: any) => rest) });
    }
    if (action === "drivers-admin") {
      const rows = await db.select().from(drivers).orderBy(desc(drivers.id));
      return OK({ drivers: rows.map(({ passwordHash, ...rest }: any) => rest) });
    }
    if (action === "customers-admin") {
      const rows = await db.select().from(customers).orderBy(desc(customers.id)).limit(200);
      return OK({ customers: rows.map(({ passwordHash, ...rest }: any) => rest) });
    }
    if (action === "store-pin") {
      await db.update(stores).set({ pinned: !!b.pinned }).where(eq(stores.id, Number(b.id)));
      return OK({ ok: true });
    }
    if (action === "store-update") {
      const { id, ...rest } = b;
      const fields: Record<string, unknown> = {};
      const allowed = ["nameAr", "nameEn", "description", "logoUrl", "bannerUrl", "status", "discountPercent", "pinned", "approved", "workingHours", "categoryId", "governorateId", "areaId"];
      for (const k of allowed) if (k in rest && rest[k] !== undefined) fields[k] = rest[k];
      if (rest.deliveryFee !== undefined) fields.deliveryFee = Number(rest.deliveryFee) || 0;
      if (rest.minOrder !== undefined) fields.minOrder = Number(rest.minOrder) || 0;
      const [updated] = await db.update(stores).set(fields).where(eq(stores.id, Number(id))).returning();
      if (!updated) return ERR("Store not found", 404);
      return OK({ ok: true, store: updated });
    }

    /* ---------------- LOCATIONS ---------------- */
    if (action === "locations-list") {
      const gov = await db.select().from(governorates);
      const ars = await db.select().from(areas);
      return OK({ governorates: gov, areas: ars });
    }
    if (action === "governorate-create") {
      await db.insert(governorates).values({ nameAr: b.nameAr, nameEn: b.nameEn });
      return OK({ ok: true });
    }
    if (action === "governorate-delete") {
      await db.delete(governorates).where(eq(governorates.id, Number(b.id)));
      return OK({ ok: true });
    }
    if (action === "area-create") {
      await db.insert(areas).values({ governorateId: Number(b.governorateId), nameAr: b.nameAr, nameEn: b.nameEn });
      return OK({ ok: true });
    }
    if (action === "area-delete") {
      await db.delete(areas).where(eq(areas.id, Number(b.id)));
      return OK({ ok: true });
    }

    /* ---------------- CATEGORIES ---------------- */
    if (action === "category-create") {
      await db.insert(categories).values({ nameAr: b.nameAr, nameEn: b.nameEn, icon: b.icon || "•", sort: Number(b.sort) || 0 });
      return OK({ ok: true });
    }
    if (action === "category-delete") {
      await db.delete(categories).where(eq(categories.id, Number(b.id)));
      return OK({ ok: true });
    }

    /* ---------------- SETTINGS (payments & commissions) ---------------- */
    if (action === "settings-get") return OK({ settings: await getAllSettings() });
    if (action === "settings-set") {
      if ("payments" in b) await setSetting("payments", b.payments);
      if ("storeCommission" in b) await setSetting("storeCommission", Number(b.storeCommission));
      if ("deliveryCommission" in b) await setSetting("deliveryCommission", Number(b.deliveryCommission));
      if ("whatsapp" in b) await setSetting("whatsapp", String(b.whatsapp));
      return OK({ ok: true });
    }

    /* ---------------- REPORTS ---------------- */
    if (action === "reports") {
      const from = String(b.from || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
      const to = String(b.to || new Date().toISOString().slice(0, 10));
      const all = await getAllSettings();
      const storeComm = typeof all.storeCommission === "number" ? (all.storeCommission as number) : 0.5;
      const delComm = typeof all.deliveryCommission === "number" ? (all.deliveryCommission as number) : 0.1;

      if (b.type === "store") {
        const rows = (await db.select().from(orders))
          .filter((o) => o.storeId === Number(b.id) && !o.status.startsWith("cancel") &&
            new Date(o.placedAt).toISOString().slice(0, 10) >= from && new Date(o.placedAt).toISOString().slice(0, 10) <= to);
        const lines = rows.map((o) => {
          const total = Number(o.total);
          const fee = Number(o.deliveryFee);
          const revenue = Number(o.subtotal) - Number(o.discountAmount);
          const commission = revenue * storeComm;
          return {
            orderNo: o.orderNo, date: o.placedAt, status: o.status,
            customer: o.customerName, total, deliveryFee: fee,
            commission: +commission.toFixed(2), net: +(total - commission).toFixed(2),
          };
        });
        const t = lines.reduce((a, l) => ({ count: a.count + 1, total: a.total + l.total, fee: a.fee + l.deliveryFee, commission: a.commission + l.commission, net: a.net + l.net }), { count: 0, total: 0, fee: 0, commission: 0, net: 0 });
        const byDay = new Map<string, number>();
        for (const l of lines) {
          const d = l.date instanceof Date ? l.date.toISOString().slice(0, 10) : String(l.date).slice(0, 10);
          byDay.set(d, (byDay.get(d) || 0) + l.total);
        }
        return OK({ lines, totals: t, from, to, byDay: [...byDay.entries()] });
      }
      if (b.type === "driver") {
        const rows = (await db.select().from(orders))
          .filter((o) => o.driverId === Number(b.id) && o.status === "delivered" &&
            o.deliveredAt && new Date(o.deliveredAt).toISOString().slice(0, 10) >= from && new Date(o.deliveredAt).toISOString().slice(0, 10) <= to);
        const lines = rows.map((o) => {
          const fee = Number(o.deliveryFee);
          const commission = fee * delComm;
          return { orderNo: o.orderNo, date: o.deliveredAt!, status: "delivered", total: Number(o.total), deliveryFee: fee, commission: +commission.toFixed(2), net: +(fee - commission).toFixed(2) };
        });
        const t = lines.reduce((a, l) => ({ count: a.count + 1, total: a.total + l.total, fee: a.fee + l.deliveryFee, commission: a.commission + l.commission, net: a.net + l.net }), { count: 0, total: 0, fee: 0, commission: 0, net: 0 });
        return OK({ lines, totals: t, from, to });
      }
      return ERR("Report type must be store or driver");
    }

    /* ---------------- ALL ORDERS ---------------- */
    if (action === "orders-all") {
      let rows = await db.select().from(orders).orderBy(desc(orders.placedAt)).limit(200);
      if (b.status) rows = rows.filter((o) => o.status === b.status);
      if (b.storeId) rows = rows.filter((o) => o.storeId === Number(b.storeId));
      const storeRows = await db.select().from(stores);
      const sm = new Map(storeRows.map((s) => [s.id, s.nameAr]));
      return OK({ orders: rows.map((o) => ({ ...o, storeName: sm.get(o.storeId) || "#" + o.storeId })) });
    }

    /* ---------------- CANCELLED LOG ---------------- */
    if (action === "cancelled-log") {
      let rows = await db.select().from(cancelledOrdersLog).orderBy(desc(cancelledOrdersLog.createdAt)).limit(200);
      if (b.storeId) rows = rows.filter((r) => r.storeId === Number(b.storeId));
      return OK({ log: rows });
    }

    /* ---------------- CMS ---------------- */
    if (action === "cms-get") return OK({ settings: await getAllSettings() });
    if (action === "cms-set") {
      const { key, value } = b;
      if (!key) return ERR("Key required");
      await setSetting(String(key), value);
      return OK({ ok: true });
    }

    /* ---------------- ADMIN MANAGEMENT (MASTER ONLY) ---------------- */
    if (action === "admins") {
      const rows = await db.select().from(admins);
      return OK({ admins: rows.map((a) => ({ ...a, passwordHash: undefined })) });
    }
    if (action === "admin-create") {
      if (!b.username || !b.email || !b.password) return ERR("username, email and password are required");
      if (String(b.password).length < 8) return ERR("Password must be at least 8 characters");
      const exists = (await db.select().from(admins).where(eq(admins.username, b.username))).length;
      if (exists) return ERR("Username already exists");
      await db.insert(admins).values({
        username: String(b.username), email: String(b.email), fullName: String(b.fullName || ""),
        passwordHash: hashPassword(String(b.password)),
        isMaster: false, permissions: Array.isArray(b.permissions) ? (b.permissions as string[]) : [],
      });
      return OK({ ok: true });
    }
    if (action === "admin-update") {
      const target = (await db.select().from(admins).where(eq(admins.id, Number(b.id))))[0];
      if (!target) return ERR("Admin not found", 404);
      if (target.isMaster) return ERR("Master account cannot be modified", 403);
      const fields: Record<string, unknown> = {};
      if (b.fullName !== undefined) fields.fullName = String(b.fullName);
      if (b.permissions !== undefined) fields.permissions = b.permissions;
      if (b.active !== undefined) fields.active = !!b.active;
      await db.update(admins).set(fields).where(eq(admins.id, target.id));
      return OK({ ok: true });
    }
    if (action === "admin-reset-password") {
      const target = (await db.select().from(admins).where(eq(admins.id, Number(b.id))))[0];
      if (!target) return ERR("Admin not found", 404);
      if (target.isMaster) return ERR("Master password is managed via recovery email only", 403);
      if (!b.password || String(b.password).length < 8) return ERR("Password must be at least 8 characters");
      await db.update(admins).set({ passwordHash: hashPassword(String(b.password)) }).where(eq(admins.id, target.id));
      return OK({ ok: true });
    }
    if (action === "admin-delete") {
      const target = (await db.select().from(admins).where(eq(admins.id, Number(b.id))))[0];
      if (!target) return ERR("Admin not found", 404);
      if (target.isMaster) return ERR("Cannot delete master account", 403);
      await db.delete(admins).where(eq(admins.id, target.id));
      return OK({ ok: true });
    }

    return ERR("Unknown action");
  } catch (e) {
    console.error(e);
    return ERR("Server error", 500);
  }
}
