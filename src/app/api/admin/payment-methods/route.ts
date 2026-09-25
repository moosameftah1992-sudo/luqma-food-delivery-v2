import { getDb } from "@/lib/sdb";
import { can, getSession } from "@/lib/auth";
import { getPaymentAvailability, isPaymentMethod, paymentSettingKey } from "@/lib/payment-methods";
import * as t from "@/db/schema";

export const runtime = "nodejs";

async function authorized() {
  const session = await getSession("admin");
  return session && can(session, "finance") ? session : null;
}

export async function GET() {
  if (!(await authorized())) return Response.json({ error: "صلاحية المالية مطلوبة" }, { status: 403 });
  const db = await getDb();
  return Response.json(await getPaymentAvailability(db), { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: Request) {
  if (!(await authorized())) return Response.json({ error: "صلاحية المالية مطلوبة" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!isPaymentMethod(body?.method) || typeof body?.enabled !== "boolean")
    return Response.json({ error: "وسيلة الدفع أو حالتها غير صالحة" }, { status: 400 });
  const db = await getDb();
  const key = paymentSettingKey(body.method);
  await db.insert(t.settings).values({ key, value: body.enabled ? "true" : "false" })
    .onConflictDoUpdate({ target: t.settings.key, set: { value: body.enabled ? "true" : "false" } });
  return Response.json(await getPaymentAvailability(db), { headers: { "Cache-Control": "private, no-store" } });
}
