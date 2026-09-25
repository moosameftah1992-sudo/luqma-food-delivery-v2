import { and, asc, desc, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "@/lib/sdb";
import { ORDER_STATUS_AR } from "@/lib/util";

export type ReportGroup = "day" | "week" | "month";
export type ReportFilters = {
  from: string;
  to: string;
  fromDate: Date;
  toExclusive: Date;
  group: ReportGroup;
  storeId?: number;
  driverId?: number;
};

function bahrainDate(at: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bahrain",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(at);
  const part = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function parseReportFilters(url: URL):
  | { ok: true; value: ReportFilters }
  | { ok: false; error: string } {
  const today = bahrainDate(new Date());
  const from = url.searchParams.get("from") || today;
  const to = url.searchParams.get("to") || today;
  const group = url.searchParams.get("group") || "day";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
    !(["day", "week", "month"] as string[]).includes(group)) {
    return { ok: false, error: "حدد تاريخي البداية والنهاية وفترة عرض صحيحة" };
  }
  const fromDate = new Date(`${from}T00:00:00+03:00`);
  const toInclusive = new Date(`${to}T00:00:00+03:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toInclusive.getTime()) ||
    bahrainDate(fromDate) !== from || bahrainDate(toInclusive) !== to || fromDate > toInclusive) {
    return { ok: false, error: "نطاق التواريخ غير صالح" };
  }
  const storeValue = url.searchParams.get("storeId");
  const driverValue = url.searchParams.get("driverId");
  const storeId = storeValue && storeValue !== "all" ? Number(storeValue) : undefined;
  const driverId = driverValue && driverValue !== "all" ? Number(driverValue) : undefined;
  if ((storeId !== undefined && (!Number.isSafeInteger(storeId) || storeId < 1)) ||
    (driverId !== undefined && (!Number.isSafeInteger(driverId) || driverId < 1))) {
    return { ok: false, error: "معرّف المتجر أو المندوب غير صالح" };
  }
  return {
    ok: true,
    value: { from, to, fromDate, toExclusive: new Date(toInclusive.getTime() + 86_400_000), group: group as ReportGroup, storeId, driverId },
  };
}

function periodOf(date: Date, group: ReportGroup) {
  const day = bahrainDate(date);
  if (group === "day") return day;
  if (group === "month") return day.slice(0, 7);
  // Calendar week starts on Sunday in Bahrain.
  const utc = new Date(`${day}T00:00:00Z`);
  utc.setUTCDate(utc.getUTCDate() - utc.getUTCDay());
  return utc.toISOString().slice(0, 10);
}

export async function reportOptions() {
  const db = await getDb();
  const [stores, drivers] = await Promise.all([
    db.select({ id: t.stores.id, name: t.stores.nameAr, nameEn: t.stores.nameEn }).from(t.stores).orderBy(asc(t.stores.nameAr)),
    db.select({ id: t.drivers.id, name: t.drivers.name, email: t.drivers.email }).from(t.drivers).orderBy(asc(t.drivers.name)),
  ]);
  return { stores, drivers };
}

type SalesBucket = {
  period: string;
  orders: number;
  grossFils: number;
  discountFils: number;
  foodSalesFils: number;
  deliveryFeesFils: number;
  salesFils: number;
  storeCommissionFils: number;
  deliveryCommissionFils: number;
  platformRevenueFils: number;
  storeNetFils: number;
};

function emptyBucket(period: string): SalesBucket {
  return { period, orders: 0, grossFils: 0, discountFils: 0, foodSalesFils: 0, deliveryFeesFils: 0, salesFils: 0, storeCommissionFils: 0, deliveryCommissionFils: 0, platformRevenueFils: 0, storeNetFils: 0 };
}

export async function buildSalesReport(filters: ReportFilters) {
  const db = await getDb();
  const [orders, options] = await Promise.all([
    db.select({
      order: t.orders,
      storeName: t.stores.nameAr,
      customerName: t.customers.name,
      customerPhone: t.customers.phone,
      driverName: t.drivers.name,
    }).from(t.orders)
      .leftJoin(t.stores, eq(t.orders.storeId, t.stores.id))
      .leftJoin(t.customers, eq(t.orders.customerId, t.customers.id))
      .leftJoin(t.drivers, eq(t.orders.driverId, t.drivers.id))
      .where(and(gte(t.orders.placedAt, filters.fromDate), lt(t.orders.placedAt, filters.toExclusive), filters.storeId ? eq(t.orders.storeId, filters.storeId) : undefined))
      .orderBy(desc(t.orders.placedAt)),
    reportOptions(),
  ]);

  const perStore = new Map<number, SalesBucket & { storeId: number; name: string }>();
  for (const store of options.stores) {
    if (!filters.storeId || filters.storeId === store.id) {
      perStore.set(store.id, { ...emptyBucket(""), storeId: store.id, name: store.name });
    }
  }
  const buckets = new Map<string, SalesBucket>();
  const totals = emptyBucket("");
  const completed: {
    id: number; code: string; placedAt: string; storeId: number; storeName: string;
    customerName: string; driverName: string; grossFils: number; discountFils: number;
    foodSalesFils: number; deliveryFeesFils: number; totalFils: number;
    storeCommissionFils: number; deliveryCommissionFils: number; platformRevenueFils: number; storeNetFils: number;
  }[] = [];
  const cancelledRows = orders.filter(({ order }) => order.status.startsWith("cancelled_") || order.status === "rejected");
  const itemLookup = new Map<number, string[]>();
  for (let index = 0; index < cancelledRows.length; index += 400) {
    const ids = cancelledRows.slice(index, index + 400).map((r) => r.order.id);
    if (!ids.length) break;
    const lines = await db.select({ orderId: t.orderItems.orderId, name: t.orderItems.nameAr, qty: t.orderItems.qty, size: t.orderItems.sizeName, priceFils: t.orderItems.lineTotalFils })
      .from(t.orderItems).where(inArray(t.orderItems.orderId, ids)).orderBy(asc(t.orderItems.id));
    for (const line of lines) {
      const list = itemLookup.get(line.orderId) ?? [];
      list.push(`${line.qty}× ${line.name}${line.size ? ` (${line.size})` : ""} — ${(line.priceFils / 1000).toFixed(3)} د.ب`);
      itemLookup.set(line.orderId, list);
    }
  }
  const cancellations = cancelledRows.map(({ order, storeName, customerName, customerPhone }) => ({
    id: order.id,
    code: order.code,
    placedAt: order.placedAt.toISOString(),
    storeName: storeName ?? "متجر محذوف",
    customerName: customerName ?? "عميل محذوف",
    customerPhone: customerPhone ?? "",
    status: order.status,
    statusLabel: ORDER_STATUS_AR[order.status] ?? order.status,
    cancelledBy: order.cancelledBy ?? "—",
    reason: order.cancelReason ?? "لم يُذكر سبب",
    items: itemLookup.get(order.id) ?? [],
    address: order.address,
    subtotalFils: order.subtotalFils,
    deliveryFeesFils: order.deliveryFeeFils,
    totalFils: order.totalFils,
    paymentStatus: order.paymentStatus,
  }));

  for (const { order, storeName, customerName, driverName } of orders) {
    // Count only delivered orders whose electronic charge or cash collection is confirmed.
    if (order.status !== "delivered" || !["captured", "cash_collected"].includes(order.paymentStatus)) continue;
    const period = periodOf(order.placedAt, filters.group);
    const bucket = buckets.get(period) ?? emptyBucket(period);
    const restaurant = perStore.get(order.storeId);
    const deliveryCommissionFils = Math.round(order.deliveryFeeFils * order.deliveryCommissionPct / 100);
    const detail = {
      id: order.id,
      code: order.code,
      placedAt: order.placedAt.toISOString(),
      storeId: order.storeId,
      storeName: storeName ?? "متجر محذوف",
      customerName: customerName ?? "عميل محذوف",
      driverName: driverName ?? "—",
      grossFils: order.subtotalFils,
      discountFils: order.discountFils,
      foodSalesFils: order.subtotalFils - order.discountFils,
      deliveryFeesFils: order.deliveryFeeFils,
      totalFils: order.totalFils,
      storeCommissionFils: order.storeCommissionFils,
      deliveryCommissionFils,
      platformRevenueFils: order.storeCommissionFils + deliveryCommissionFils,
      storeNetFils: order.subtotalFils - order.discountFils - order.storeCommissionFils,
    };
    completed.push(detail);
    for (const target of [totals, bucket, restaurant].filter((entry): entry is SalesBucket => Boolean(entry))) {
      target.orders++;
      target.grossFils += detail.grossFils;
      target.discountFils += detail.discountFils;
      target.foodSalesFils += detail.foodSalesFils;
      target.deliveryFeesFils += detail.deliveryFeesFils;
      target.salesFils += detail.totalFils;
      target.storeCommissionFils += detail.storeCommissionFils;
      target.deliveryCommissionFils += detail.deliveryCommissionFils;
      target.platformRevenueFils += detail.platformRevenueFils;
      target.storeNetFils += detail.storeNetFils;
    }
    buckets.set(period, bucket);
  }

  return {
    filters: { from: filters.from, to: filters.to, group: filters.group, storeId: filters.storeId ?? null },
    totals: { ...totals, cancellations: cancellations.length, allOrders: orders.length },
    breakdown: [...perStore.values()].sort((a, b) => b.salesFils - a.salesFils),
    timeline: [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period)),
    completed,
    cancellations,
    stores: options.stores,
  };
}

export type SalesReport = Awaited<ReturnType<typeof buildSalesReport>>;

type DriverBucket = {
  period: string;
  completed: number;
  deliveryFeesFils: number;
  commissionFils: number;
  netFils: number;
};
function emptyDriverBucket(period: string): DriverBucket {
  return { period, completed: 0, deliveryFeesFils: 0, commissionFils: 0, netFils: 0 };
}

export async function buildDriverReport(filters: ReportFilters) {
  const db = await getDb();
  const [rows, payouts, options] = await Promise.all([
    db.select({ order: t.orders, storeName: t.stores.nameAr, driverName: t.drivers.name })
      .from(t.orders)
      .leftJoin(t.stores, eq(t.orders.storeId, t.stores.id))
      .leftJoin(t.drivers, eq(t.orders.driverId, t.drivers.id))
      .where(and(gte(t.orders.placedAt, filters.fromDate), lt(t.orders.placedAt, filters.toExclusive),
        eq(t.orders.status, "delivered"), inArray(t.orders.paymentStatus, ["captured", "cash_collected"]),
        isNotNull(t.orders.driverId), filters.driverId ? eq(t.orders.driverId, filters.driverId) : undefined))
      .orderBy(desc(t.orders.placedAt)),
    db.select({ id: t.payouts.id, driverId: t.payouts.driverId, amountFils: t.payouts.amountFils, note: t.payouts.note, createdAt: t.payouts.createdAt })
      .from(t.payouts)
      .where(and(gte(t.payouts.createdAt, filters.fromDate), lt(t.payouts.createdAt, filters.toExclusive), filters.driverId ? eq(t.payouts.driverId, filters.driverId) : undefined))
      .orderBy(desc(t.payouts.createdAt)),
    reportOptions(),
  ]);
  const byDriver = new Map<number, DriverBucket & { driverId: number; name: string; email: string; paidFils: number }>();
  for (const driver of options.drivers) {
    if (!filters.driverId || filters.driverId === driver.id)
      byDriver.set(driver.id, { ...emptyDriverBucket(""), driverId: driver.id, name: driver.name, email: driver.email, paidFils: 0 });
  }
  const totals = { ...emptyDriverBucket(""), paidFils: 0, remainingFils: 0 };
  const buckets = new Map<string, DriverBucket>();
  const orders = rows.map(({ order, storeName, driverName }) => {
    const commissionFils = Math.round(order.deliveryFeeFils * order.deliveryCommissionPct / 100);
    const detail = {
      id: order.id,
      code: order.code,
      placedAt: order.placedAt.toISOString(),
      driverId: order.driverId!,
      driverName: driverName ?? "مندوب محذوف",
      storeName: storeName ?? "متجر محذوف",
      deliveryFeesFils: order.deliveryFeeFils,
      commissionPct: order.deliveryCommissionPct,
      commissionFils,
      netFils: order.deliveryFeeFils - commissionFils,
    };
    const period = periodOf(order.placedAt, filters.group);
    const bucket = buckets.get(period) ?? emptyDriverBucket(period);
    const owner = byDriver.get(detail.driverId);
    for (const target of [totals, bucket, owner].filter((entry): entry is DriverBucket => Boolean(entry))) {
      target.completed++;
      target.deliveryFeesFils += detail.deliveryFeesFils;
      target.commissionFils += detail.commissionFils;
      target.netFils += detail.netFils;
    }
    buckets.set(period, bucket);
    return detail;
  });
  const payoutEntries = payouts.map((payout) => ({ ...payout, createdAt: payout.createdAt.toISOString(), driverName: byDriver.get(payout.driverId)?.name ?? "مندوب محذوف" }));
  for (const payout of payoutEntries) {
    totals.paidFils += payout.amountFils;
    const summary = byDriver.get(payout.driverId);
    if (summary) summary.paidFils += payout.amountFils;
  }
  totals.remainingFils = totals.netFils - totals.paidFils;
  return {
    filters: { from: filters.from, to: filters.to, group: filters.group, driverId: filters.driverId ?? null },
    totals,
    breakdown: [...byDriver.values()].map((driver) => ({ ...driver, remainingFils: driver.netFils - driver.paidFils })).sort((a, b) => b.netFils - a.netFils),
    timeline: [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period)),
    orders,
    payouts: payoutEntries,
    drivers: options.drivers,
  };
}

export type DriverReport = Awaited<ReturnType<typeof buildDriverReport>>;
