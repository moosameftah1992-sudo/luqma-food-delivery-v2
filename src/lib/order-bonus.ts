import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import * as t from "@/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Deduct credit only if the account can cover it at commit time. */
export async function reserveBonus(tx: Transaction, customerId: number, amountFils: number, code: string) {
  if (!amountFils) return;
  const [updated] = await tx.update(t.customers)
    .set({ bonusBalanceFils: sql`${t.customers.bonusBalanceFils} - ${amountFils}` })
    .where(and(eq(t.customers.id, customerId), eq(t.customers.status, "active"), eq(t.customers.emailVerified, true), gte(t.customers.bonusBalanceFils, amountFils)))
    .returning({ id: t.customers.id });
  if (!updated) throw new Error("BONUS_BALANCE_CHANGED");
  await tx.insert(t.customerBonuses).values({ customerId, amountFils: -amountFils, note: `استخدام البونس للطلب ${code}` });
}

/** Caller must first win a conditional, single-use order state transition. */
export async function restoreReservedBonus(tx: Transaction, order: typeof t.orders.$inferSelect, note: string) {
  if (!order.bonusUsedFils || !order.customerId) return;
  const [customer] = await tx.update(t.customers)
    .set({ bonusBalanceFils: sql`${t.customers.bonusBalanceFils} + ${order.bonusUsedFils}` })
    .where(eq(t.customers.id, order.customerId))
    .returning({ id: t.customers.id });
  if (customer) await tx.insert(t.customerBonuses).values({
    customerId: order.customerId,
    amountFils: order.bonusUsedFils,
    note: `${note} ${order.code}`,
  });
}
