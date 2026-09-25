import { and, asc, eq } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "@/lib/sdb";
import { can, getSession } from "@/lib/auth";
import { parseWorkingHours } from "@/lib/working-hours";

type Context = { params: Promise<{ id: string }> };

async function authorizedStoreId(ctx: Context) {
  const session = await getSession("admin");
  if (!session || (!can(session, "users") && !can(session, "operations"))) return null;
  const id = Number((await ctx.params).id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: Request, ctx: Context) {
  const storeId = await authorizedStoreId(ctx);
  if (!storeId) return Response.json({ error: "غير مصرّح" }, { status: 403 });
  const db = await getDb();
  const [store] = await db
    .select({
      id: t.stores.id,
      nameAr: t.stores.nameAr,
      nameEn: t.stores.nameEn,
      status: t.stores.status,
      workingHours: t.stores.workingHours,
    })
    .from(t.stores)
    .where(eq(t.stores.id, storeId))
    .limit(1);
  if (!store) return Response.json({ error: "المتجر غير موجود" }, { status: 404 });
  const items = await db
    .select({
      id: t.items.id,
      storeId: t.items.storeId,
      nameAr: t.items.nameAr,
      nameEn: t.items.nameEn,
      priceFils: t.items.priceFils,
      available: t.items.available,
    })
    .from(t.items)
    .where(eq(t.items.storeId, storeId))
    .orderBy(asc(t.items.id));
  return Response.json({ store, items }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: Request, ctx: Context) {
  const storeId = await authorizedStoreId(ctx);
  if (!storeId) return Response.json({ error: "غير مصرّح" }, { status: 403 });
  const db = await getDb();
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object")
    return Response.json({ error: "البيانات غير صالحة" }, { status: 400 });

  if (body.action === "status") {
    if (!["open", "busy", "closed"].includes(body.status))
      return Response.json({ error: "حالة المتجر غير صالحة" }, { status: 400 });
    const [updated] = await db
      .update(t.stores)
      .set({ status: body.status })
      .where(eq(t.stores.id, storeId))
      .returning({ id: t.stores.id, status: t.stores.status });
    return Response.json(updated ?? { error: "المتجر غير موجود" }, { status: updated ? 200 : 404 });
  }

  if (body.action === "hours") {
    const parsed = parseWorkingHours(body.workingHours);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
    const [updated] = await db
      .update(t.stores)
      .set({ workingHours: parsed.periods })
      .where(eq(t.stores.id, storeId))
      .returning({ id: t.stores.id, workingHours: t.stores.workingHours });
    return Response.json(updated ?? { error: "المتجر غير موجود" }, { status: updated ? 200 : 404 });
  }

  if (body.action === "availability") {
    const itemId = Number(body.itemId);
    if (!Number.isSafeInteger(itemId) || itemId < 1 || typeof body.available !== "boolean")
      return Response.json({ error: "الصنف أو حالته غير صالحين" }, { status: 400 });
    const [updated] = await db
      .update(t.items)
      .set({ available: body.available })
      .where(and(eq(t.items.id, itemId), eq(t.items.storeId, storeId)))
      .returning({ id: t.items.id, available: t.items.available });
    return Response.json(updated ?? { error: "الصنف غير موجود في هذا المتجر" }, { status: updated ? 200 : 404 });
  }

  return Response.json({ error: "الإجراء غير مدعوم" }, { status: 400 });
}
