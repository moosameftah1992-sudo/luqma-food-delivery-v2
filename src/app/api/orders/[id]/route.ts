import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, stores, drivers, cancelledOrdersLog, customers } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getCustomer, getStoreSession, getDriverSession, getAdminSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const o = (await db.select().from(orders).where(eq(orders.id, Number(id))))[0];
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const store = (await db.select().from(stores).where(eq(stores.id, o.storeId)))[0];
  const driver = o.driverId ? (await db.select().from(drivers).where(eq(drivers.id, o.driverId)))[0] : null;
  return NextResponse.json({ order: o, store, driver });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const oid = Number(id);
  const b = await req.json();
  const action = String(b.action);
  const [o] = await db.select().from(orders).where(eq(orders.id, oid));
  if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const store = (await db.select().from(stores).where(eq(stores.id, o.storeId)))[0];
  const admin = await getAdminSession();

  async function logCancel(actor: string, reason: string, driverName: string | null = null) {
    await db.insert(cancelledOrdersLog).values({
      orderNo: o.orderNo,
      storeId: o.storeId,
      storeName: store?.nameAr || "",
      customerName: o.customerName,
      actor,
      driverName,
      reason,
      total: o.total,
    });
  }

  if (action === "accept") {
    if (!admin && ((await getStoreSession())?.id !== o.storeId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (o.status !== "pending") return NextResponse.json({ error: "Order already handled" }, { status: 400 });
    await db.update(orders).set({ status: "accepted", storeAcceptedAt: new Date() }).where(eq(orders.id, oid));
    return NextResponse.json({ ok: true, status: "accepted" });
  }

  if (action === "reject") {
    if (!admin && ((await getStoreSession())?.id !== o.storeId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (o.status !== "pending") return NextResponse.json({ error: "Order already handled" }, { status: 400 });
    await db.update(orders).set({ status: "cancelled", cancelledReason: b.reason || "Rejected by store" }).where(eq(orders.id, oid));
    await logCancel("store", String(b.reason || "رفض المطعم"));
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  if (action === "preparing" || action === "ready") {
    if (!admin && ((await getStoreSession())?.id !== o.storeId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const next = action === "preparing" ? "accepted" : "ready";
    if (action === "preparing") {
      if (!["accepted", "pending"].includes(o.status)) return NextResponse.json({ error: "Invalid state" }, { status: 400 });
      await db.update(orders).set({ status: "preparing", storeAcceptedAt: o.storeAcceptedAt || new Date() }).where(eq(orders.id, oid));
      return NextResponse.json({ ok: true, status: "preparing" });
    }
    if (!["accepted", "preparing"].includes(o.status)) return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    void next;
    await db.update(orders).set({ status: "ready", readyAt: new Date() }).where(eq(orders.id, oid));
    return NextResponse.json({ ok: true, status: "ready" });
  }

  if (action === "driver-accept") {
    const d = await getDriverSession();
    if (!d && !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (o.status !== "ready") return NextResponse.json({ error: "Order is not available" }, { status: 400 });
    // first-come first-served: only succeeds while unassigned
    const [updated] = await db
      .update(orders)
      .set({ status: "out_for_delivery", driverId: d ? d.id : o.driverId, driverAcceptedAt: new Date() })
      .where(and(eq(orders.id, oid), isNull(orders.driverId), eq(orders.status, "ready")))
      .returning();
    if (!updated) return NextResponse.json({ error: "Order was already taken by another driver" }, { status: 409 });
    return NextResponse.json({ ok: true, status: "out_for_delivery" });
  }

  if (action === "driver-cancel") {
    const d = await getDriverSession();
    if (!d && !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (o.driverId !== (d ? d.id : o.driverId) || !["ready", "out_for_delivery"].includes(o.status))
      return NextResponse.json({ error: "Cannot cancel this order" }, { status: 400 });
    const dRow = d ? (await db.select().from(drivers).where(eq(drivers.id, d.id)))[0] : null;
    await db.update(orders).set({ status: "ready", driverId: null, driverAcceptedAt: null, readyAt: new Date() }).where(eq(orders.id, oid));
    await logCancel("driver", String(b.reason || ""), dRow?.name || null);
    return NextResponse.json({ ok: true, status: "ready", rebroadcast: true });
  }

  if (action === "deliver") {
    const d = await getDriverSession();
    if (!d && !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (o.status !== "out_for_delivery") return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    await db.update(orders).set({ status: "delivered", deliveredAt: new Date() }).where(eq(orders.id, oid));
    return NextResponse.json({ ok: true, status: "delivered" });
  }

  if (action === "customer-cancel") {
    const c = await getCustomer();
    if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (o.customerId !== c.id) return NextResponse.json({ error: "Not your order" }, { status: 403 });
    const ageMin = (Date.now() - new Date(o.placedAt).getTime()) / 60000;
    if (ageMin > 5) return NextResponse.json({ error: "Cancellation window (5 min) has passed. Please contact support." }, { status: 400 });
    if (!["pending", "accepted"].includes(o.status)) return NextResponse.json({ error: "This order can no longer be cancelled" }, { status: 400 });
    if (!b.reason) return NextResponse.json({ error: "A cancellation reason is required" }, { status: 400 });
    // refund bonus
    const cust = (await db.select().from(customers).where(eq(customers.id, c.id)))[0];
    if (cust && Number(o.bonusUsed) > 0)
      await db.update(customers).set({ bonusBalance: (Number(cust.bonusBalance) + Number(o.bonusUsed)).toFixed(2) }).where(eq(customers.id, c.id));
    await db.update(orders).set({ status: "cancelled", cancelledReason: String(b.reason) }).where(eq(orders.id, oid));
    await logCancel("customer", String(b.reason));
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
