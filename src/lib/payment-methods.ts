import { inArray } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "@/lib/sdb";
import { tapReady } from "@/lib/tap";
import { PAYMENT_METHODS, PAYMENT_LABELS, type PaymentMethod } from "@/lib/payment-types";

export { PAYMENT_METHODS, PAYMENT_LABELS };
export type { PaymentMethod };

export function paymentSettingKey(method: PaymentMethod) {
  return `payment_method_${method}_enabled`;
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && PAYMENT_METHODS.some((method) => method === value);
}

type Database = Awaited<ReturnType<typeof getDb>>;

/** When no setting exists, each method is enabled; online methods still need live Tap credentials. */
export async function getPaymentAvailability(db: Database) {
  const rows = await db.select({ key: t.settings.key, value: t.settings.value })
    .from(t.settings)
    .where(inArray(t.settings.key, PAYMENT_METHODS.map(paymentSettingKey)));
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const tapConfigured = tapReady();
  return {
    tapConfigured,
    methods: Object.fromEntries(PAYMENT_METHODS.map((method) => {
      const enabled = byKey.get(paymentSettingKey(method)) !== "false";
      const configured = method === "cash" || tapConfigured;
      return [method, { enabled, configured, available: enabled && configured, ...PAYMENT_LABELS[method] }];
    })) as Record<PaymentMethod, { enabled: boolean; configured: boolean; available: boolean; ar: string; en: string }>,
  };
}
