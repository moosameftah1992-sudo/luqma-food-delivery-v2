import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { restoreReservedBonus } from "@/lib/order-bonus";

const API = "https://api.tap.company/v2";
const TERMINAL = new Set(["ABANDONED", "CANCELLED", "FAILED", "DECLINED", "RESTRICTED", "VOID", "TIMEDOUT"]);

export type TapCharge = {
  id: string; object?: string; status: string; amount: number; currency: string; live_mode?: boolean;
  transaction?: { url?: string; created?: string | number };
  reference?: { order?: string; payment?: string; gateway?: string };
  merchant?: { id?: string };
  card?: { last_four?: string };
  source?: { id?: string };
};

export function tapReady() {
  const key = process.env.TAP_SECRET_KEY || "";
  return Boolean(key && process.env.TAP_MERCHANT_ID && process.env.APP_URL?.startsWith("https://") && (process.env.NODE_ENV !== "production" || key.startsWith("sk_live_")));
}

async function tapRequest<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  if (!tapReady()) throw new Error("TAP_NOT_CONFIGURED");
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.TAP_SECRET_KEY}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => ({})) as T & { errors?: unknown; message?: string };
  if (!response.ok) {
    console.error("[luqma] Tap request rejected", response.status, result);
    throw new Error("TAP_REQUEST_FAILED");
  }
  return result;
}

export async function createTapCharge(input: { code: string; totalFils: number; name: string; email: string; phone: string; method: "card" | "benefitpay" }) {
  const base = process.env.APP_URL!.replace(/\/$/, "");
  const parts = input.name.trim().split(/\s+/);
  return tapRequest<TapCharge>("/charges/", "POST", {
    amount: Number((input.totalFils / 1000).toFixed(3)), currency: "BHD",
    threeDSecure: true, save_card: false, customer_initiated: true,
    description: `Luqma order ${input.code}`,
    reference: { transaction: input.code, order: input.code, idempotent: input.code },
    receipt: { email: true, sms: false },
    customer: { first_name: parts[0] || "Customer", last_name: parts.slice(1).join(" ") || "Luqma", email: input.email, phone: { country_code: "973", number: input.phone.replace(/\D/g, "").replace(/^973/, "") } },
    merchant: { id: process.env.TAP_MERCHANT_ID },
    source: { id: input.method === "benefitpay" ? "src_benefitpay" : "src_card" },
    post: { url: `${base}/api/payments/webhook` },
    redirect: { url: `${base}/payment/return?order=${encodeURIComponent(input.code)}` },
  });
}

export async function retrieveTapCharge(id: string) {
  if (!/^chg_[a-zA-Z0-9_-]{10,100}$/.test(id)) throw new Error("INVALID_CHARGE_ID");
  return tapRequest<TapCharge>(`/charges/${encodeURIComponent(id)}`, "GET");
}

export async function reconcileCharge(charge: TapCharge) {
  if (charge.currency !== "BHD" || !charge.id) throw new Error("INVALID_CURRENCY_OR_CHARGE");
  const db = await getDb();
  const [order] = await db.select().from(t.orders).where(eq(t.orders.paymentRef, charge.id)).limit(1);
  if (!order) return { status: "not_found", order: null };
  if (order.code !== charge.reference?.order || Math.round(charge.amount * 1000) !== order.totalFils - order.bonusUsedFils ||
      (charge.merchant?.id && charge.merchant.id !== process.env.TAP_MERCHANT_ID) ||
      (process.env.NODE_ENV === "production" && charge.live_mode !== true))
    throw new Error("PAYMENT_MISMATCH");

  if (charge.status === "CAPTURED") {
    const [captured] = await db.update(t.orders).set({ paymentStatus: "captured", status: "pending", placedAt: new Date(), updatedAt: new Date(), cardLast4: charge.card?.last_four ?? null })
      .where(and(eq(t.orders.id, order.id), eq(t.orders.paymentStatus, "initiated"), eq(t.orders.status, "payment_pending"))).returning();
    return { status: "captured", order: captured || order };
  }
  if (TERMINAL.has(charge.status)) {
    await db.transaction(async (tx) => {
      const [failed] = await tx.update(t.orders)
        .set({ paymentStatus: "failed", status: "payment_failed", bonusRestored: true, updatedAt: new Date() })
        .where(and(eq(t.orders.id, order.id), eq(t.orders.paymentStatus, "initiated"), eq(t.orders.status, "payment_pending")))
        .returning();
      if (failed) await restoreReservedBonus(tx, order, "إعادة بونس بعد فشل الدفع للطلب");
    });
    return { status: "failed", order };
  }
  return { status: order.paymentStatus === "captured" ? "captured" : "initiated", order };
}

export async function requestTapRefund(order: typeof t.orders.$inferSelect, reason: string) {
  if (order.paymentStatus !== "captured" || !order.paymentRef) return false;
  const chargedFils = order.totalFils - order.bonusUsedFils;
  if (chargedFils <= 0) return false;
  const result = await tapRequest<{ id: string; status: string }>("/refunds/", "POST", {
    charge_id: order.paymentRef, amount: Number((chargedFils / 1000).toFixed(3)), currency: "BHD",
    reason: "requested_by_customer", description: reason.slice(0, 220),
    reference: { order: order.code, idempotent: `refund-${order.code}` },
  });
  if (!result.id) throw new Error("REFUND_REQUEST_FAILED");
  return true;
}

/** Tap's documented x_id..x_created HMAC-SHA256 signature, BHD uses 3 decimals. */
export function verifyTapWebhookSignature(charge: TapCharge, received: string | null) {
  if (!received || !process.env.TAP_SECRET_KEY) return false;
  const signed = `x_id${charge.id}x_amount${Number(charge.amount).toFixed(3)}x_currency${charge.currency}x_gateway_reference${charge.reference?.gateway || ""}x_payment_reference${charge.reference?.payment || ""}x_status${charge.status}x_created${charge.transaction?.created || ""}`;
  const expected = createHmac("sha256", process.env.TAP_SECRET_KEY).update(signed).digest("hex");
  const a = Buffer.from(expected, "hex"); const b = Buffer.from(received, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
