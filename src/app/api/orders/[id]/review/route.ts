import { and, eq } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "@/lib/sdb";
import { getSession } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await getDb();
  const sess = await getSession("customer");
  if (!sess) return Response.json({ error: "غير مصرّح" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const rating = Math.min(5, Math.max(1, Number(body.rating) || 5));
  const comment = String(body.comment || "").slice(0, 500);

  const [order] = await db.select().from(t.orders).where(eq(t.orders.id, Number(id)));
  if (!order || order.customerId !== sess.id)
    return Response.json({ error: "غير مصرّح" }, { status: 403 });
  if (order.status !== "delivered")
    return Response.json({ error: "التقييم متاح بعد التوصيل فقط" }, { status: 400 });

  const dup = await db
    .select()
    .from(t.reviews)
    .where(and(eq(t.reviews.orderId, order.id), eq(t.reviews.customerId, sess.id)));
  if (dup.length) return Response.json({ error: "قيّمت هذا الطلب مسبقاً" }, { status: 409 });

  await db.insert(t.reviews).values({
    orderId: order.id,
    storeId: order.storeId,
    customerId: sess.id,
    rating,
    comment,
  });

  await db
    .update(t.stores)
    .set({
      ratingSum: order.storeId ? (await currentSum(order.storeId)) + rating : rating,
      ratingCount: (await currentCount(order.storeId)) + 1,
    })
    .where(eq(t.stores.id, order.storeId));

  return Response.json({ ok: true });
}

async function currentSum(storeId: number) {
  const db = await getDb();
  const [s] = await db.select().from(t.stores).where(eq(t.stores.id, storeId));
  return s?.ratingSum ?? 0;
}
async function currentCount(storeId: number) {
  const db = await getDb();
  const [s] = await db.select().from(t.stores).where(eq(t.stores.id, storeId));
  return s?.ratingCount ?? 0;
}
