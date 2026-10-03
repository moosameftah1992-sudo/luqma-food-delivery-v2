import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, products, stores, customers, drivers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCustomer, getStoreSession, getDriverSession, getAdminSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

const num = (v: unknown) => Number(v || 0);

export async function POST(req: Request) {
  const c = await getCustomer();
  if (!c) return NextResponse.json({ error: "Please sign in to order" }, { status: 401 });
  const b = await req.json();
  const storeId = Number(b.storeId);
  const items: { productId: number; qty: number; options: { name: string; choice: string; price: number }[] }[] = b.items || [];
  if (!items.length) return NextResponse.json({ error: "Cart is empty" });

  const [store] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!store || !store.approved) return NextResponse.json({ error: "Store unavailable" }, { status: 400 });
  if (store.status === "closed") return NextResponse.json({ error: "Store is currently closed" }, { status: 400 });

  const [cust] = await db.select().from(customers).where(eq(customers.id, c.id));
  if (!cust) return NextResponse.json({ error: "Customer not found" }, { status: 401 });

  // Build item snapshot & totals server-side
  let subtotal = 0;
  const snapshot: Record<string, unknown>[] = [];
  for (const it of items) {
    const p = (await db.select().from(products).where(eq(products.id, Number(it.productId))))[0];
    if (!p || p.storeId !== storeId || !p.available)
      return NextResponse.json({ error: `Item unavailable: ${p?.nameAr || "#" + it.productId}` }, { status: 400 });
    const opts = Array.isArray(it.options) ? it.options : [];
    const optsSum = opts.reduce((s, o) => s + num(o.price), 0);
    const unit = num(p.price) + optsSum;
    const qty = Math.max(1, Number(it.qty) || 1);
    subtotal += unit * qty;
    snapshot.push({
      productId: p.id,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      image: p.images?.[0] || "",
      qty,
      unitPrice: unit,
      options: opts,
      lineTotal: unit * qty,
    });
  }

  const discount = (subtotal * store.discountPercent) / 100;
  const deliveryFee = num(store.deliveryFee);
  if (subtotal < num(store.minOrder))
    return NextResponse.json({ error: `Minimum order is ${store.minOrder} BD` }, { status: 400 });

  const settings = await getSettings();
  const pm = String(b.paymentMethod || "cod");
  if (pm === "card" && !settings.payments.card) return NextResponse.json({ error: "Card payments are disabled" }, { status: 400 });
  if (pm === "benefi" && !settings.payments.benefi) return NextResponse.json({ error: "BenefitPay is disabled" }, { status: 400 });
  if (pm === "cod" && !settings.payments.cod) return NextResponse.json({ error: "Cash on delivery is disabled" }, { status: 400 });

  let bonusUsed = Math.min(num(b.bonusUsed), Number(cust.bonusBalance), subtotal - discount);
  if (bonusUsed < 0) bonusUsed = 0;
  const total = Math.max(0, subtotal - discount + deliveryFee - bonusUsed);

  const orderNo = "LQ-" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 90 + 10);
  const [order] = await db
    .insert(orders)
    .values({
      orderNo,
      customerId: cust.id,
      storeId,
      customerName: cust.name,
      address: b.address || {},
      items: snapshot,
      subtotal: subtotal.toFixed(2),
      discountAmount: discount.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      bonusUsed: bonusUsed.toFixed(2),
      total: total.toFixed(2),
      paymentMethod: pm,
      status: "pending",
    })
    .returning();

  for (const it of snapshot) {
    await db.insert(orderItems).values({
      orderId: order.id,
      productId: it.productId as number,
      name: it.nameAr as string,
      qty: it.qty as number,
      unitPrice: (it.unitPrice as number).toFixed(2),
      options: it.options as never,
      lineTotal: (it.lineTotal as number).toFixed(2),
    });
  }
  if (bonusUsed > 0) {
    await db
      .update(customers)
      .set({ bonusBalance: (num(cust.bonusBalance) - bonusUsed).toFixed(2) })
      .where(eq(customers.id, cust.id));
  }
  return NextResponse.json({ ok: true, order });
}

async function decorate(list: (typeof orders.$inferSelect)[]) {
  const storeIds = [...new Set(list.map((o) => o.storeId))];
  const driverIds = list.map((o) => o.driverId).filter(Boolean) as number[];
  const sMap = new Map((storeIds.length ? await db.select().from(stores).where(eq(stores.id, -1)).then(() => db.select().from(stores)) : []).map((s) => [s.id, s]));
  void sMap;
  const storeRows = storeIds.length ? await db.select().from(stores) : [];
  const driverRows = driverIds.length ? await db.select().from(drivers) : [];
  const sm = new Map(storeRows.map((s) => [s.id, s]));
  const dm = new Map(driverRows.map((d) => [d.id, d]));
  return list.map((o) => {
    const st: any = sm.get(o.storeId) || null;
    const dr: any = o.driverId ? dm.get(o.driverId) || null : null;
    return {
      ...o,
      store: st ? { ...st, passwordHash: undefined } : null,
      driver: dr ? { ...dr, passwordHash: undefined } : null,
    };
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") || "customer";
  const status = url.searchParams.get("status");

  if (scope === "customer") {
    const c = await getCustomer();
    if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    let rows = await db.select().from(orders).where(eq(orders.customerId, c.id)).orderBy(desc(orders.placedAt)).limit(50);
    if (status) rows = rows.filter((o) => o.status === status);
    return NextResponse.json({ orders: await decorate(rows) });
  }

  if (scope === "store") {
    const s = await getStoreSession();
    const admin = await getAdminSession();
    const storeId = s ? s.id : Number(url.searchParams.get("storeId") || 0);
    if (!s && !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    let rows = await db.select().from(orders).where(eq(orders.storeId, storeId)).orderBy(desc(orders.placedAt)).limit(100);
    if (status) rows = rows.filter((o) => o.status === status);
    return NextResponse.json({ orders: await decorate(rows) });
  }

  if (scope === "driver") {
    const d = await getDriverSession();
    if (!d) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    let rows = await db.select().from(orders).where(eq(orders.driverId, d.id)).orderBy(desc(orders.placedAt)).limit(100);
    if (status) rows = rows.filter((o) => o.status === status);
    return NextResponse.json({ orders: await decorate(rows) });
  }

  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let rows = await db.select().from(orders).orderBy(desc(orders.placedAt)).limit(200);
  if (status) rows = rows.filter((o) => o.status === status);
  return NextResponse.json({ orders: await decorate(rows) });
}
