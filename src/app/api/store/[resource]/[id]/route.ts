import { eq } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "@/lib/sdb";
import { getSession } from "@/lib/auth";
import { num } from "@/lib/util";

type Ctx = { params: Promise<{ resource: string; id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { resource, id } = await ctx.params;
  const db = await getDb();
  const sess = await getSession("store");
  if (!sess) return Response.json({ error: "غير مصرّح" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const rowId = Number(id);

  if (resource === "items") {
    const [existing] = await db.select().from(t.items).where(eq(t.items.id, rowId));
    if (!existing || existing.storeId !== sess.id) return deny();
    if (body.available !== undefined && typeof body.available !== "boolean")
      return Response.json({ error: "حالة توفر الصنف غير صالحة" }, { status: 400 });
    const priceChanged = body.priceFils !== undefined && num(body.priceFils) !== existing.priceFils;
    if (priceChanged) {
      // price integrity: changes must be approved by the Super Admin first
      await db.insert(t.priceRequests).values({
        storeId: sess.id,
        itemId: existing.id,
        target: "item",
        targetName: existing.nameAr,
        oldPriceFils: existing.priceFils,
        newPriceFils: num(body.priceFils),
      });
    }
    const [u] = await db
      .update(t.items)
      .set({
        nameAr: body.nameAr !== undefined ? String(body.nameAr) : undefined,
        description: body.description !== undefined ? String(body.description) : undefined,
        image: body.image !== undefined ? String(body.image) : undefined,
        categoryId: body.categoryId !== undefined ? num(body.categoryId) : undefined,
        discountPct: body.discountPct !== undefined ? num(body.discountPct) : undefined,
        available: body.available !== undefined ? body.available : undefined,
        priceFils: priceChanged ? existing.priceFils : undefined,
      })
      .where(eq(t.items.id, rowId))
      .returning();
    return Response.json({ ...u, priceRequested: priceChanged });
  }

  if (resource === "categories") {
    const [existing] = await db.select().from(t.categories).where(eq(t.categories.id, rowId));
    if (!existing || existing.storeId !== sess.id) return deny();
    const [u] = await db
      .update(t.categories)
      .set({ nameAr: body.nameAr !== undefined ? String(body.nameAr) : undefined })
      .where(eq(t.categories.id, rowId))
      .returning();
    return Response.json(u);
  }

  if (resource === "discounts") {
    const [existing] = await db.select().from(t.discounts).where(eq(t.discounts.id, rowId));
    if (!existing || existing.storeId !== sess.id) return deny();
    const [u] = await db
      .update(t.discounts)
      .set({
        percent: body.percent !== undefined ? num(body.percent) : undefined,
        active: body.active !== undefined ? Boolean(body.active) : undefined,
      })
      .where(eq(t.discounts.id, rowId))
      .returning();
    return Response.json(u);
  }

  return Response.json({ error: "مورد غير معروف" }, { status: 404 });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { resource, id } = await ctx.params;
  const db = await getDb();
  const sess = await getSession("store");
  if (!sess) return Response.json({ error: "غير مصرّح" }, { status: 401 });
  const rowId = Number(id);

  const guard = async (rows: { storeId: number }[]) => {
    if (!rows.length || rows[0].storeId !== sess.id) return deny();
    return null;
  };

  if (resource === "items") {
    const rows = await db.select().from(t.items).where(eq(t.items.id, rowId));
    const g = await guard(rows);
    if (g) return g;
    await db.delete(t.items).where(eq(t.items.id, rowId));
    return Response.json({ ok: true });
  }
  if (resource === "categories") {
    const rows = await db.select().from(t.categories).where(eq(t.categories.id, rowId));
    const g = await guard(rows);
    if (g) return g;
    await db.delete(t.categories).where(eq(t.categories.id, rowId));
    return Response.json({ ok: true });
  }
  if (resource === "discounts") {
    const rows = await db.select().from(t.discounts).where(eq(t.discounts.id, rowId));
    const g = await guard(rows);
    if (g) return g;
    await db.delete(t.discounts).where(eq(t.discounts.id, rowId));
    return Response.json({ ok: true });
  }
  return Response.json({ error: "مورد غير معروف" }, { status: 404 });
}

function deny() {
  return Response.json({ error: "غير مصرّح" }, { status: 403 });
}
