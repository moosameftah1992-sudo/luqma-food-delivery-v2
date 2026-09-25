import * as t from "@/db/schema";
import { daysAgo, isoDay } from "@/lib/util";

export type OrderRow = typeof t.orders.$inferSelect;

export function resolveRange(preset: string, from?: string | null, to?: string | null) {
  const end = to ? new Date(to + "T23:59:59") : new Date();
  if (from) return { from: new Date(from + "T00:00:00"), to: end };
  if (preset === "daily") return { from: daysAgo(0), to: end };
  if (preset === "weekly") return { from: daysAgo(6), to: end };
  return { from: daysAgo(29), to: end };
}

export function groupFor(preset: string) {
  return preset === "monthly" ? "week" : "day";
}

export type ReportBucket = {
  period: string;
  orders: number;
  delivered: number;
  cancelled: number;
  gross: number;
  discount: number;
  delivery: number;
  commission: number;
  net: number;
};

/** Splits an order set into calendar buckets plus an exact totals ledger. */
export function aggregate(
  rows: OrderRow[],
  group: "day" | "week" | "month",
  kind: "store" | "driver" | "platform",
) {
  const buckets = new Map<string, ReportBucket>();
  const totals = {
    orders: rows.length,
    delivered: 0,
    cancelled: 0,
    gross: 0,
    discount: 0,
    delivery: 0,
    commission: 0,
    net: 0,
  };

  for (const o of rows) {
    const d = new Date(o.placedAt);
    const key =
      group === "week"
        ? weekKey(d)
        : group === "month"
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          : isoDay(d);
    const b: ReportBucket =
      buckets.get(key) ??
      { period: key, orders: 0, delivered: 0, cancelled: 0, gross: 0, discount: 0, delivery: 0, commission: 0, net: 0 };

    const done = o.status === "delivered";
    const cancelled = o.status.startsWith("cancelled") || o.status === "rejected";
    b.orders += 1;
    if (done) b.delivered += 1;
    if (cancelled) b.cancelled += 1;

    if (done) {
      const deliveryCut = Math.round((o.deliveryFeeFils * o.deliveryCommissionPct) / 100);
      const commission =
        kind === "driver" ? deliveryCut : kind === "platform" ? o.storeCommissionFils + deliveryCut : o.storeCommissionFils;
      const net =
        kind === "driver"
          ? o.deliveryFeeFils - deliveryCut
          : o.subtotalFils - o.discountFils - o.storeCommissionFils;

      b.gross += o.subtotalFils;
      b.discount += o.discountFils;
      b.delivery += o.deliveryFeeFils;
      b.commission += commission;
      b.net += net;

      totals.gross += o.subtotalFils;
      totals.discount += o.discountFils;
      totals.delivery += o.deliveryFeeFils;
      totals.commission += commission;
      totals.net += net;
      totals.delivered += 1;
    }
    if (cancelled) totals.cancelled += 1;
    buckets.set(key, b);
  }

  return {
    rows: [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period)),
    totals,
  };
}

function weekKey(d: Date) {
  const start = new Date(d);
  start.setDate(d.getDate() - 3);
  return isoDay(start);
}
