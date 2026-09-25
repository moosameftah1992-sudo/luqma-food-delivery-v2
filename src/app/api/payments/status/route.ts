import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/sdb";
import { reconcileCharge, retrieveTapCharge } from "@/lib/tap";
import * as t from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await getSession("customer");
  if (!session) return Response.json({ error: "سجّل الدخول لمتابعة الدفع" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("order") || "";
  const id = searchParams.get("tap_id") || "";
  if (!/^LQ-[0-9]{6}$/.test(code) || !/^chg_[a-zA-Z0-9_-]{10,100}$/.test(id)) return Response.json({ error: "مراجع دفع غير صالحة" }, { status: 400 });
  const db = await getDb();
  const [order] = await db.select().from(t.orders).where(and(eq(t.orders.code, code), eq(t.orders.customerId, session.id), eq(t.orders.paymentRef, id))).limit(1);
  if (!order) return Response.json({ error: "الطلب غير موجود" }, { status: 404 });
  try {
    const charge = await retrieveTapCharge(id);
    const result = await reconcileCharge(charge);
    return Response.json({ ok: true, code, status: result.status, totalFils: order.totalFils });
  } catch (error) {
    console.error("[luqma] payment reconciliation failed", error);
    return Response.json({ error: "تعذّر التحقق من بوابة الدفع. حاول لاحقاً أو تواصل مع الدعم." }, { status: 503 });
  }
}
