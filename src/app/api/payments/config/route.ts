import { eq } from "drizzle-orm";
import { getDb } from "@/lib/sdb";
import { getSession } from "@/lib/auth";
import { getPaymentAvailability } from "@/lib/payment-methods";
import * as t from "@/db/schema";

export async function GET() {
  const db = await getDb();
  const [availability, session] = await Promise.all([getPaymentAvailability(db), getSession("customer")]);
  const [customer] = session
    ? await db.select({ bonusBalanceFils: t.customers.bonusBalanceFils, status: t.customers.status })
        .from(t.customers).where(eq(t.customers.id, session.id)).limit(1)
    : [null];
  return Response.json({
    ready: Object.values(availability.methods).some((method) => method.available),
    methods: availability.methods,
    bonusBalanceFils: customer?.status === "active" ? customer.bonusBalanceFils : 0,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
