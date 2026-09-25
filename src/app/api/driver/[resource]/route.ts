import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "@/lib/sdb";
import { getSession } from "@/lib/auth";
import { aggregate } from "@/lib/reports";

export async function GET(req: Request) {
  const db = await getDb();
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const resource = parts[parts.length - 1];
  const sess = await getSession("driver");
  if (!sess) return Response.json({ error: "غير مصرّح" }, { status: 401 });

  const [me] = await db.select().from(t.drivers).where(eq(t.drivers.id, sess.id));
  if (!me || me.status !== "active" || !me.emailVerified)
    return Response.json({ error: "حساب المندوب غير مفعّل" }, { status: 403 });

  if (resource === "profile") {
    return Response.json({ ...me, passwordHash: undefined });
  }

  if (resource === "board") {
    // broadcast pool: unassigned orders that are ready/accepted
    const pool = await db
      .select({
        order: t.orders,
        storeName: t.stores.nameAr,
        storeAddress: t.stores.address,
        storePhone: t.stores.phone,
        areaName: t.areas.nameAr,
        customerName: t.customers.name,
      })
      .from(t.orders)
      .leftJoin(t.stores, eq(t.orders.storeId, t.stores.id))
      .leftJoin(t.areas, eq(t.orders.areaId, t.areas.id))
      .leftJoin(t.customers, eq(t.orders.customerId, t.customers.id))
      .where(
        and(
          isNull(t.orders.driverId),
          inArray(t.orders.paymentStatus, ["captured", "cash_due"]),
          inArray(t.orders.status, ["accepted", "ready"]),
        ),
      )
      .orderBy(desc(t.orders.placedAt))
      .limit(30);

    const mine = await db
      .select({
        order: t.orders,
        storeName: t.stores.nameAr,
        storeAddress: t.stores.address,
        storePhone: t.stores.phone,
        areaName: t.areas.nameAr,
        customerName: t.customers.name,
      })
      .from(t.orders)
      .leftJoin(t.stores, eq(t.orders.storeId, t.stores.id))
      .leftJoin(t.areas, eq(t.orders.areaId, t.areas.id))
      .leftJoin(t.customers, eq(t.orders.customerId, t.customers.id))
      .where(and(eq(t.orders.driverId, sess.id), inArray(t.orders.status, ["assigned", "onway"])))
      .orderBy(desc(t.orders.placedAt));

    const shape = (r: (typeof pool)[number]) => ({
      ...r.order,
      storeName: r.storeName,
      storeAddress: r.storeAddress,
      storePhone: r.storePhone,
      areaName: r.areaName,
      customerName: r.customerName,
    });

    return Response.json({
      online: me.online,
      pool: pool.map(shape),
      mine: mine.map(shape),
    });
  }

  if (resource === "ledger") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const start = from ? new Date(from + "T00:00:00") : new Date(Date.now() - 30 * 86400000);
    const end = to ? new Date(to + "T23:59:59") : new Date();
    const rows = await db
      .select()
      .from(t.orders)
      .where(
        and(
          eq(t.orders.driverId, sess.id),
          gte(t.orders.placedAt, start),
          lte(t.orders.placedAt, end),
        ),
      )
      .orderBy(desc(t.orders.placedAt));
    const delivered = rows.filter((r) => r.status === "delivered");
    const stats = aggregate(delivered, "day", "driver");
    const paid = await db.select().from(t.payouts).where(eq(t.payouts.driverId, sess.id));
    const paidTotal = paid.reduce((s, p) => s + p.amountFils, 0);
    const dues = delivered.reduce(
      (s, o) =>
        s + (o.deliveryFeeFils - Math.round((o.deliveryFeeFils * o.deliveryCommissionPct) / 100)),
      0,
    );
    return Response.json({
      rows: rows.map((r) => ({
        ...r,
        driverEarningsFils:
          r.status === "delivered"
            ? r.deliveryFeeFils - Math.round((r.deliveryFeeFils * r.deliveryCommissionPct) / 100)
            : 0,
      })),
      chart: stats.rows,
      totals: {
        orders: rows.length,
        delivered: delivered.length,
        duesFils: dues,
        paidFils: paidTotal,
        remainingFils: dues - paidTotal,
        commissionFils: stats.totals.commission,
      },
      payouts: paid.sort((a, b) => b.id - a.id),
      commissionPct: me.commissionPct,
    });
  }

  return Response.json({ error: "مورد غير معروف" }, { status: 404 });
}

export async function POST(req: Request) {
  const db = await getDb();
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const resource = parts[parts.length - 1];
  const sess = await getSession("driver");
  if (!sess) return Response.json({ error: "غير مصرّح" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (resource === "profile") {
    const [u] = await db
      .update(t.drivers)
      .set({
        online: body.online !== undefined ? Boolean(body.online) : undefined,
        phone: body.phone !== undefined ? String(body.phone) : undefined,
        name: body.name !== undefined ? String(body.name) : undefined,
      })
      .where(eq(t.drivers.id, sess.id))
      .returning();
    return Response.json({ ...u, passwordHash: undefined });
  }

  return Response.json({ error: "مورد غير معروف" }, { status: 404 });
}
