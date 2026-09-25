import { and, eq, inArray, isNull } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "@/lib/sdb";
import { can, getSession } from "@/lib/auth";
import { requestTapRefund } from "@/lib/tap";
import { restoreReservedBonus } from "@/lib/order-bonus";

type Ctx = { params: Promise<{ id: string }> };
const CANCEL_WINDOW_MIN = 5;
const ACTIVE = ["pending", "accepted", "ready", "assigned", "onway"];

export async function POST(req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: "رقم الطلب غير صالح" }, { status: 400 });
  const session = await getSession();
  if (!session) return Response.json({ error: "غير مصرّح" }, { status: 401 });
  const db = await getDb();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const reason = String(body.reason || "").trim();
  const fail = (message: string, status = 400) => Response.json({ error: message }, { status });
  const [order] = await db.select().from(t.orders).where(eq(t.orders.id, id)).limit(1);
  if (!order) return fail("الطلب غير موجود", 404);

  if (session.role === "store") {
    if (order.storeId !== session.id) return fail("غير مصرّح", 403);
    if (action === "accept") return transition(id, ["pending"], { status: "accepted" });
    if (action === "ready") return transition(id, ["accepted"], { status: "ready" });
    if (action === "reject" || action === "cancel") {
      if (reason.length < 3 || reason.length > 400) return fail("سبب الإلغاء أو الرفض مطلوب (3 إلى 400 حرف)");
      if (action === "reject" && order.status !== "pending") return fail("لا يمكن رفض الطلب بعد قبوله", 409);
      return cancelOrder(order, action === "reject" ? "rejected" : "cancelled_store", reason, "store");
    }
    return fail("إجراء غير متاح للمتجر");
  }

  if (session.role === "driver") {
    const [driver] = await db.select({ status: t.drivers.status, emailVerified: t.drivers.emailVerified, online: t.drivers.online })
      .from(t.drivers).where(eq(t.drivers.id, session.id)).limit(1);
    if (!driver || driver.status !== "active" || !driver.emailVerified) return fail("حساب المندوب غير مفعل", 403);
    if (action === "accept") {
      if (!driver.online) return fail("فعّل الاتصال لتلقي الطلبات", 403);
      const [claimed] = await db.update(t.orders)
        .set({ driverId: session.id, status: "assigned", updatedAt: new Date() })
        .where(and(eq(t.orders.id, id), isNull(t.orders.driverId), inArray(t.orders.paymentStatus, ["captured", "cash_due"]), inArray(t.orders.status, ["accepted", "ready"])))
        .returning({ id: t.orders.id });
      return claimed ? Response.json({ ok: true }) : fail("عذراً، استلم مندوب آخر هذا الطلب", 409);
    }
    if (order.driverId !== session.id) return fail("غير مصرّح", 403);
    if (action === "pickup") return transition(id, ["assigned"], { status: "onway" });
    if (action === "deliver") {
      if (order.paymentStatus === "cash_due" && body.cashCollected !== true)
        return fail("يجب تأكيد استلام المبلغ النقدي من العميل قبل التسليم");
      const [delivered] = await db.update(t.orders)
        .set({ status: "delivered", paymentStatus: order.paymentStatus === "cash_due" ? "cash_collected" : order.paymentStatus, updatedAt: new Date() })
        .where(and(eq(t.orders.id, id), eq(t.orders.driverId, session.id), eq(t.orders.status, "onway"), inArray(t.orders.paymentStatus, ["captured", "cash_due"])))
        .returning({ status: t.orders.status, paymentStatus: t.orders.paymentStatus });
      return delivered ? Response.json({ ok: true, ...delivered }) : fail("لم يعد الطلب قابلاً للتسليم", 409);
    }
    if (action === "cancel") {
      if (reason.length < 3 || reason.length > 400) return fail("سبب إلغاء التوصيل مطلوب (3 إلى 400 حرف)");
      const [released] = await db.update(t.orders)
        .set({ driverId: null, status: "ready", cancelReason: reason, cancelledBy: "driver", updatedAt: new Date() })
        .where(and(eq(t.orders.id, id), eq(t.orders.driverId, session.id), inArray(t.orders.status, ["assigned", "onway"])))
        .returning({ id: t.orders.id });
      return released ? Response.json({ ok: true, rebroadcast: true }) : fail("لا يمكن إعادة بث هذا الطلب الآن", 409);
    }
    return fail("إجراء غير متاح للمندوب");
  }

  if (session.role === "customer") {
    if (order.customerId !== session.id) return fail("غير مصرّح", 403);
    if (action !== "cancel") return fail("إجراء غير متاح للعميل");
    if (reason.length < 3 || reason.length > 400) return fail("سبب الإلغاء مطلوب (3 إلى 400 حرف)");
    const elapsed = Date.now() - order.placedAt.getTime();
    if (elapsed < 0 || elapsed >= CANCEL_WINDOW_MIN * 60_000)
      return fail(`انتهت مهلة الإلغاء (${CANCEL_WINDOW_MIN} دقائق)؛ تواصل مع الدعم`, 409);
    return cancelOrder(order, "cancelled_customer", reason, "customer");
  }

  if (!can(session, "operations") && !can(session, "finance")) return fail("ليس لديك صلاحية لإلغاء الطلبات", 403);
  if (action !== "cancel") return fail("إجراء غير معروف");
  if (reason.length < 3 || reason.length > 400) return fail("سبب الإلغاء مطلوب (3 إلى 400 حرف)");
  return cancelOrder(order, "cancelled_store", reason, "admin");
}

async function transition(id: number, states: string[], patch: Partial<typeof t.orders.$inferInsert>) {
  const db = await getDb();
  const [updated] = await db.update(t.orders)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(t.orders.id, id), inArray(t.orders.status, states), inArray(t.orders.paymentStatus, ["captured", "cash_due"])))
    .returning({ status: t.orders.status });
  return updated ? Response.json({ ok: true, status: updated.status }) : Response.json({ error: "تغيرت حالة الطلب؛ حدّث القائمة" }, { status: 409 });
}

async function cancelOrder(
  order: typeof t.orders.$inferSelect,
  status: string,
  reason: string,
  cancelledBy: string,
) {
  const db = await getDb();
  if (!ACTIVE.includes(order.status))
    return Response.json({ error: "لا يمكن إلغاء طلب مكتمل أو ملغى مسبقاً" }, { status: 409 });
  if (!["captured", "cash_due"].includes(order.paymentStatus))
    return Response.json({ error: "لم يُؤكد الطلب للدفع بعد" }, { status: 409 });
  const requiresRefund = order.paymentStatus === "captured" && Boolean(order.paymentRef) && order.totalFils > order.bonusUsedFils;
  if (requiresRefund) {
    try {
      if (!(await requestTapRefund(order, reason))) throw new Error("REFUND_REQUEST_FAILED");
    } catch (error) {
      console.error("[luqma] refund request failed", order.code, error);
      return Response.json({ error: "تعذّر بدء استرداد المبلغ؛ لم يُلغَ الطلب. تواصل مع الدعم" }, { status: 502 });
    }
  }
  const nextPaymentStatus = requiresRefund ? "refund_pending" : order.paymentStatus === "cash_due" ? "cash_cancelled" : "refunded";
  const [cancelled] = await db.transaction(async (tx) => {
    const [changed] = await tx.update(t.orders)
      .set({ status, paymentStatus: nextPaymentStatus, cancelReason: reason, cancelledBy, bonusRestored: true, updatedAt: new Date() })
      .where(and(eq(t.orders.id, order.id), inArray(t.orders.status, ACTIVE), eq(t.orders.paymentStatus, order.paymentStatus), eq(t.orders.bonusRestored, false)))
      .returning();
    if (changed) await restoreReservedBonus(tx, order, "استعادة بونس الطلب الملغى");
    return [changed];
  });
  if (!cancelled) return Response.json({ error: "تغيرت حالة الطلب أو انتهت مهلة الإلغاء؛ حدّث القائمة" }, { status: 409 });
  return Response.json({ ok: true, status: cancelled.status, paymentStatus: nextPaymentStatus, bonusRestoredFils: order.bonusUsedFils });
}
