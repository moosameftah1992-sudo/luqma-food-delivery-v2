import { NextResponse } from "next/server";
import { db } from "@/db";
import { drivers, orders, stores } from "@/db/schema";
import { eq, isNull, desc, sql } from "drizzle-orm";
import { getDriverSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export async function GET(req: Request) {
  const d = await getDriverSession();
  if (!d) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "broadcast";

  const me = (await db.select().from(drivers).where(eq(drivers.id, d.id)))[0];
  if (!me) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  if (action === "broadcast") {
    const open = await db
      .select()
      .from(orders)
      .where(sql`${orders.status} = 'ready' AND ${orders.driverId} IS NULL AND ${orders.placedAt} > now() - interval '3 hours'`)
      .orderBy(desc(orders.readyAt))
      .limit(20);
    const storeIds = [...new Set(open.map((o) => o.storeId))];
    const storeRows = storeIds.length ? await db.select().from(stores) : [];
    const sm = new Map(storeRows.map((s) => [s.id, s]));
    const mine = await db.select().from(orders).where(eq(orders.driverId, me.id)).orderBy(desc(orders.placedAt)).limit(20);
    const meSafe: any = { ...me, passwordHash: undefined };
    return NextResponse.json({
      me: meSafe,
      broadcast: open.map((o) => {
        const st: any = sm.get(o.storeId) || null;
        return { ...o, store: st ? { ...st, passwordHash: undefined } : null };
      }),
      mine: mine.filter((o) => !["delivered", "cancelled"].includes(o.status)),
    });
  }

  if (action === "ledger") {
    const from = url.searchParams.get("from") || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const to = url.searchParams.get("to") || new Date().toISOString().slice(0, 10);
    const settings = await getSettings();
    const rows = await db
      .select()
      .from(orders)
      .where(sql`${orders.driverId} = ${me.id} AND ${orders.status} = 'delivered' AND date(${orders.deliveredAt}) >= date(${from}) AND date(${orders.deliveredAt}) <= date(${to})`)
      .orderBy(desc(orders.deliveredAt));
    const lines = rows.map((o) => {
      const fee = Number(o.deliveryFee);
      const commission = fee * settings.deliveryCommission;
      return {
        orderNo: o.orderNo,
        date: o.deliveredAt,
        total: Number(o.total),
        deliveryFee: fee,
        commission: +commission.toFixed(2),
        net: +(fee - commission).toFixed(2),
        address: o.address?.line || o.address?.area || "",
      };
    });
    const totals = lines.reduce(
      (a, l) => ({ count: a.count + 1, fees: a.fees + l.deliveryFee, commission: a.commission + l.commission, net: a.net + l.net }),
      { count: 0, fees: 0, commission: 0, net: 0 }
    );
    return NextResponse.json({ lines, totals, from, to });
  }

  return NextResponse.json({ me });
}

export async function POST(req: Request) {
  const d = await getDriverSession();
  if (!d) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json();
  const me = (await db.select().from(drivers).where(eq(drivers.id, d.id)))[0];
  if (!me) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  if (b.action === "toggle-online") {
    const next = !me.isOnline;
    await db.update(drivers).set({ isOnline: next }).where(eq(drivers.id, d.id));
    return NextResponse.json({ ok: true, isOnline: next });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
