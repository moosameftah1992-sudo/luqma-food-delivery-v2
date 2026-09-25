import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { createTapCharge, reconcileCharge } from "@/lib/tap";
import { getPaymentAvailability, isPaymentMethod } from "@/lib/payment-methods";
import { reserveBonus, restoreReservedBonus } from "@/lib/order-bonus";
import { effectiveStoreStatus } from "@/lib/working-hours";
import * as t from "@/db/schema";
import { getDb } from "@/lib/sdb";
import { getSession, orderCode } from "@/lib/auth";

export async function GET(req: Request) {
  const db = await getDb();
  const sess = await getSession();
  if (!sess) return Response.json({ error: "غير مصرّح" }, { status: 401 });
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") || sess.role;
  const status = url.searchParams.get("status");

  let where;
  if (scope === "customer" && sess.role === "customer") where = eq(t.orders.customerId, sess.id);
  else if (scope === "store" && sess.role === "store") where = eq(t.orders.storeId, sess.id);
  else if (scope === "driver" && sess.role === "driver") where = eq(t.orders.driverId, sess.id);
  else if (sess.role === "admin") where = undefined;
  else return Response.json({ error: "غير مصرّح" }, { status: 403 });

  const rows = await db
    .select({ order: t.orders, storeName: t.stores.nameAr, customerName: t.customers.name, driverName: t.drivers.name, areaName: t.areas.nameAr })
    .from(t.orders)
    .leftJoin(t.stores, eq(t.orders.storeId, t.stores.id))
    .leftJoin(t.customers, eq(t.orders.customerId, t.customers.id))
    .leftJoin(t.drivers, eq(t.orders.driverId, t.drivers.id))
    .leftJoin(t.areas, eq(t.orders.areaId, t.areas.id))
    .where(where)
    .orderBy(desc(t.orders.placedAt))
    .limit(200);

  const visible = sess.role === "store" || sess.role === "driver"
    ? rows.filter((r) => ["captured", "cash_due", "cash_collected", "refund_pending", "refunded"].includes(r.order.paymentStatus))
    : rows;
  const filtered = status ? visible.filter((r) => r.order.status === status) : visible;
  const ids = filtered.map((r) => r.order.id);
  const lines = ids.length ? await db.select().from(t.orderItems).where(inArray(t.orderItems.orderId, ids)) : [];
  return Response.json(filtered.map((r) => ({
    ...r.order,
    storeName: r.storeName,
    customerName: r.customerName,
    driverName: r.driverName,
    areaName: r.areaName,
    items: lines.filter((l) => l.orderId === r.order.id),
  })));
}

export async function POST(req: Request) {
  const session = await getSession("customer");
  if (!session) return Response.json({ error: "سجّل الدخول لإتمام الطلب" }, { status: 401 });
  const db = await getDb();
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: "بيانات الطلب غير صالحة" }, { status: 400 }); }
  if (!isPaymentMethod(body.paymentMethod)) return Response.json({ error: "اختر وسيلة دفع صحيحة" }, { status: 400 });
  const paymentMethod = body.paymentMethod;
  const availability = await getPaymentAvailability(db);
  if (!availability.methods[paymentMethod].enabled)
    return Response.json({ error: "وسيلة الدفع المختارة غير متاحة حالياً" }, { status: 409 });
  if (!availability.methods[paymentMethod].configured)
    return Response.json({ error: "وسيلة الدفع الإلكترونية غير جاهزة حالياً؛ اختر وسيلة أخرى" }, { status: 503 });

  const [customer] = await db.select().from(t.customers).where(eq(t.customers.id, session.id)).limit(1);
  if (!customer || !customer.emailVerified || customer.status !== "active")
    return Response.json({ error: "يرجى تأكيد بريدك الإلكتروني أولاً" }, { status: 403 });
  const address = String(body.address || "").trim().slice(0, 300);
  if (address.length < 5) return Response.json({ error: "أدخل عنوان توصيل كاملاً" }, { status: 400 });
  const cartLines = body.items;
  if (!Array.isArray(cartLines) || !cartLines.length || cartLines.length > 40)
    return Response.json({ error: "السلة فارغة أو كبيرة جداً" }, { status: 400 });
  const [store] = await db.select().from(t.stores).where(eq(t.stores.id, Number(body.storeId))).limit(1);
  if (!store || !store.approved || store.banned || effectiveStoreStatus(store.status, store.workingHours) !== "open")
    return Response.json({ error: "المطعم غير متاح للطلب حالياً أو خارج أوقات العمل" }, { status: 409 });
  const [area] = await db.select().from(t.areas).where(and(eq(t.areas.id, Number(body.areaId)), eq(t.areas.active, true))).limit(1);
  if (!area) return Response.json({ error: "اختر منطقة توصيل صالحة" }, { status: 400 });
  const [gov] = await db.select().from(t.governorates).where(and(eq(t.governorates.id, area.governorateId), eq(t.governorates.active, true))).limit(1);
  if (!gov) return Response.json({ error: "المحافظة غير متاحة حالياً" }, { status: 400 });

  const menu = await db.select().from(t.items).where(eq(t.items.storeId, store.id));
  const [allSizes, allAddons] = await Promise.all([db.select().from(t.itemSizes), db.select().from(t.itemAddons)]);
  const lines: { itemId: number; nameAr: string; sizeName: string | null; unitPriceFils: number; qty: number; addons: { name: string; price: number }[]; lineTotalFils: number }[] = [];
  let subtotal = 0;
  for (const cartLine of cartLines) {
    const row = cartLine as { itemId?: number; sizeId?: number | null; qty?: number; addons?: number[] };
    const item = menu.find((m) => m.id === Number(row.itemId) && m.available);
    if (!item) return Response.json({ error: "صنف غير متاح في القائمة" }, { status: 409 });
    const qty = Number(row.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 30)
      return Response.json({ error: "الكمية غير صالحة" }, { status: 400 });
    const size = row.sizeId ? allSizes.find((s) => s.id === Number(row.sizeId) && s.itemId === item.id) : null;
    if (row.sizeId && !size) return Response.json({ error: "الحجم المختار غير صالح" }, { status: 400 });
    const addonIds = Array.isArray(row.addons) ? row.addons.map(Number) : [];
    if (addonIds.length > 12 || new Set(addonIds).size !== addonIds.length)
      return Response.json({ error: "الإضافات غير صالحة" }, { status: 400 });
    const chosen = addonIds.map((id) => allAddons.find((a) => a.id === id && a.itemId === item.id));
    if (chosen.some((a) => !a)) return Response.json({ error: "إضافة غير متاحة لهذا الصنف" }, { status: 400 });
    const unitPriceFils = Math.round((size?.priceFils ?? item.priceFils) * (100 - item.discountPct) / 100);
    const addons = chosen.map((a) => ({ name: a!.nameAr, price: a!.priceFils }));
    const lineTotalFils = (unitPriceFils + addons.reduce((sum, a) => sum + a.price, 0)) * qty;
    subtotal += lineTotalFils;
    lines.push({ itemId: item.id, nameAr: item.nameAr, sizeName: size?.nameAr ?? null, unitPriceFils, qty, addons, lineTotalFils });
  }
  if (subtotal < store.minOrderFils)
    return Response.json({ error: `أقل طلب لهذا المطعم ${(store.minOrderFils / 1000).toFixed(3)} د.ب` }, { status: 400 });
  let discount = 0;
  const discountCode = String(body.discountCode || "").trim().toUpperCase();
  if (discountCode) {
    const [promo] = await db.select().from(t.discounts).where(and(eq(t.discounts.storeId, store.id), eq(t.discounts.code, discountCode), eq(t.discounts.active, true))).limit(1);
    if (!promo) return Response.json({ error: "رمز الخصم غير صالح" }, { status: 400 });
    discount = Math.round(subtotal * promo.percent / 100);
  }
  const total = subtotal - discount + area.deliveryFeeFils;
  if (total < 100 || total > 10_000_000) return Response.json({ error: "المبلغ غير صالح" }, { status: 400 });
  const bonusUsedFils = body.useBonus === true ? Math.min(customer.bonusBalanceFils, total) : 0;
  const amountDueFils = total - bonusUsedFils;
  const [commissionSetting] = await db.select({ value: t.settings.value }).from(t.settings).where(eq(t.settings.key, "deliveryCommissionPct")).limit(1);
  const deliveryCommissionPct = Math.min(100, Math.max(0, Number(commissionSetting?.value ?? 10) || 10));

  let order: typeof t.orders.$inferSelect;
  try {
    order = await db.transaction(async (tx) => {
      const code = orderCode();
      await reserveBonus(tx, customer.id, bonusUsedFils, code);
      const [created] = await tx.insert(t.orders).values({
        code, customerId: customer.id, storeId: store.id, areaId: area.id,
        status: paymentMethod === "cash" || amountDueFils === 0 ? "pending" : "payment_pending",
        paymentStatus: amountDueFils === 0 ? "captured" : paymentMethod === "cash" ? "cash_due" : "unpaid",
        subtotalFils: subtotal, deliveryFeeFils: area.deliveryFeeFils, discountFils: discount,
        totalFils: total, bonusUsedFils, storeCommissionFils: store.commissionFils,
        deliveryCommissionPct, paymentMethod, address, note: String(body.note || "").slice(0, 500),
      }).returning();
      await tx.insert(t.orderItems).values(lines.map((line) => ({ ...line, orderId: created.id })));
      return created;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "BONUS_BALANCE_CHANGED")
      return Response.json({ error: "تغير رصيد البونس أثناء إتمام الطلب؛ حدّث الصفحة وأعد المحاولة" }, { status: 409 });
    console.error("[luqma] order creation failed", error);
    return Response.json({ error: "تعذر إنشاء الطلب. لم يُحجز رصيدك" }, { status: 503 });
  }

  if (paymentMethod === "cash" || amountDueFils === 0) return Response.json({
    ok: true, code: order.code, id: order.id, paid: amountDueFils === 0,
    cash: paymentMethod === "cash", amountDueFils, totalFils: total, bonusUsedFils,
  });

  try {
    const charge = await createTapCharge({ code: order.code, totalFils: amountDueFils, name: customer.name, email: customer.email, phone: customer.phone, method: paymentMethod });
    if (!charge.id || !["INITIATED", "CAPTURED"].includes(charge.status)) throw new Error("INVALID_TAP_RESPONSE");
    await db.update(t.orders).set({ paymentRef: charge.id, paymentStatus: "initiated" }).where(eq(t.orders.id, order.id));
    if (charge.status === "CAPTURED") {
      await reconcileCharge(charge);
      return Response.json({ ok: true, code: order.code, id: order.id, paid: true, cash: false, amountDueFils, bonusUsedFils });
    }
    if (!charge.transaction?.url?.startsWith("https://")) throw new Error("INVALID_TAP_REDIRECT");
    return Response.json({ ok: true, code: order.code, id: order.id, redirectUrl: charge.transaction.url, amountDueFils, bonusUsedFils });
  } catch (error) {
    console.error("[luqma] payment initiation failed", error);
    // If Tap may have created a charge, keep the reservation until the verified webhook
    // or customer support reconciles it. Never pretend a possibly paid order failed.
    if (error instanceof Error && ["TAP_REQUEST_FAILED", "TAP_NOT_CONFIGURED"].includes(error.message)) {
      await db.transaction(async (tx) => {
        const [failed] = await tx.update(t.orders)
          .set({ status: "payment_failed", paymentStatus: "failed", bonusRestored: true, updatedAt: new Date() })
          .where(and(eq(t.orders.id, order.id), eq(t.orders.status, "payment_pending"), eq(t.orders.paymentStatus, "unpaid")))
          .returning();
        if (failed) await restoreReservedBonus(tx, order, "إعادة بونس بعد فشل الدفع للطلب");
      });
    }
    return Response.json({ error: "لم يكتمل تأكيد الدفع. تحقق من طلباتك أو تواصل مع الدعم قبل إعادة المحاولة." }, { status: 502 });
  }
}
