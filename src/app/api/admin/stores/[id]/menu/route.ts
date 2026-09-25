import { and, asc, eq } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "@/lib/sdb";
import { can, getSession } from "@/lib/auth";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
type DbClient = Awaited<ReturnType<typeof getDb>>;

type ItemInput = {
  categoryId: number | null;
  nameAr: string;
  nameEn: string | null;
  description: string;
  descriptionEn: string | null;
  image: string;
  priceFils: number;
  discountPct: number;
  available: boolean;
  sizes: { nameAr: string; priceFils: number }[];
  addons: { nameAr: string; priceFils: number }[];
};

function validInt(value: unknown, min = 0, max = 10_000_000) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function parseOptions(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length > 30) return { error: `${label} غير صالحة` } as const;
  const entries: { nameAr: string; priceFils: number }[] = [];
  for (const row of value) {
    const nameAr = typeof row?.nameAr === "string" ? row.nameAr.trim() : "";
    if (!nameAr || nameAr.length > 100 || !validInt(row?.priceFils, 0, 10_000_000))
      return { error: `تحقق من اسم وسعر ${label}` } as const;
    entries.push({ nameAr, priceFils: row.priceFils });
  }
  return { entries } as const;
}

async function authorize(ctx: Ctx) {
  const session = await getSession("admin");
  if (!session || (!can(session, "users") && !can(session, "operations"))) return null;
  const storeId = Number((await ctx.params).id);
  if (!Number.isSafeInteger(storeId) || storeId <= 0) return null;
  return storeId;
}

async function validateItem(body: Record<string, unknown>, storeId: number, db: DbClient): Promise<
  | { ok: true; value: ItemInput }
  | { ok: false; error: string }
> {
  const nameAr = typeof body.nameAr === "string" ? body.nameAr.trim() : "";
  const nameEn = typeof body.nameEn === "string" ? body.nameEn.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const descriptionEn = typeof body.descriptionEn === "string" ? body.descriptionEn.trim() : "";
  const image = typeof body.image === "string" ? body.image.trim() : "";
  if (!nameAr || nameAr.length > 150 || nameEn.length > 150 || description.length > 1000 || descriptionEn.length > 1000 || image.length > 1200)
    return { ok: false, error: "اسم الصنف أو وصفه غير صالح" };
  if (!validInt(body.priceFils) || !validInt(body.discountPct, 0, 90) || typeof body.available !== "boolean")
    return { ok: false, error: "السعر أو نسبة الخصم أو حالة توفر الصنف غير صالحة" };
  const categoryId = body.categoryId == null || body.categoryId === "" ? null : Number(body.categoryId);
  if (categoryId !== null) {
    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) return { ok: false, error: "القسم غير صالح" };
    const [category] = await db.select({ id: t.categories.id }).from(t.categories).where(and(eq(t.categories.id, categoryId), eq(t.categories.storeId, storeId))).limit(1);
    if (!category) return { ok: false, error: "هذا القسم لا يتبع المطعم المحدد" };
  }
  const sizes = parseOptions(body.sizes ?? [], "الأحجام");
  if ("error" in sizes) return { ok: false, error: sizes.error || "الأحجام غير صالحة" };
  const addons = parseOptions(body.addons ?? [], "الإضافات");
  if ("error" in addons) return { ok: false, error: addons.error || "الإضافات غير صالحة" };
  return {
    ok: true,
    value: {
      categoryId, nameAr, nameEn: nameEn || null, description, descriptionEn: descriptionEn || null,
      image, priceFils: body.priceFils as number, discountPct: body.discountPct as number,
      available: body.available as boolean, sizes: sizes.entries, addons: addons.entries,
    },
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  const storeId = await authorize(ctx);
  if (!storeId) return Response.json({ error: "لا تملك صلاحية لإدارة القائمة" }, { status: 403 });
  const db = await getDb();
  const [store] = await db.select({ id: t.stores.id, nameAr: t.stores.nameAr, nameEn: t.stores.nameEn })
    .from(t.stores).where(eq(t.stores.id, storeId)).limit(1);
  if (!store) return Response.json({ error: "المطعم غير موجود" }, { status: 404 });
  const [categories, items] = await Promise.all([
    db.select().from(t.categories).where(eq(t.categories.storeId, storeId)).orderBy(asc(t.categories.sortOrder), asc(t.categories.id)),
    db.select().from(t.items).where(eq(t.items.storeId, storeId)).orderBy(asc(t.items.sortOrder), asc(t.items.id)),
  ]);
  const itemIds = items.map((item) => item.id);
  let sizes: typeof t.itemSizes.$inferSelect[] = [];
  let addons: typeof t.itemAddons.$inferSelect[] = [];
  if (itemIds.length) {
    const { inArray } = await import("drizzle-orm");
    [sizes, addons] = await Promise.all([
      db.select().from(t.itemSizes).where(inArray(t.itemSizes.itemId, itemIds)).orderBy(asc(t.itemSizes.id)),
      db.select().from(t.itemAddons).where(inArray(t.itemAddons.itemId, itemIds)).orderBy(asc(t.itemAddons.id)),
    ]);
  }
  return Response.json({ store, categories, items: items.map((item) => ({
    ...item,
    sizes: sizes.filter((size) => size.itemId === item.id),
    addons: addons.filter((addon) => addon.itemId === item.id),
  })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request, ctx: Ctx) {
  const storeId = await authorize(ctx);
  if (!storeId) return Response.json({ error: "لا تملك صلاحية لإدارة القائمة" }, { status: 403 });
  const db = await getDb();
  const [store] = await db.select({ id: t.stores.id }).from(t.stores).where(eq(t.stores.id, storeId)).limit(1);
  if (!store) return Response.json({ error: "المطعم غير موجود" }, { status: 404 });
  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  if (body.action === "category") {
    const nameAr = typeof body.nameAr === "string" ? body.nameAr.trim() : "";
    const nameEn = typeof body.nameEn === "string" ? body.nameEn.trim() : "";
    if (!nameAr || nameAr.length > 100 || nameEn.length > 100) return Response.json({ error: "اسم القسم غير صالح" }, { status: 400 });
    const [category] = await db.insert(t.categories).values({ storeId, nameAr, nameEn: nameEn || null }).returning();
    return Response.json(category, { status: 201 });
  }
  if (body.action === "discount_all") {
    if (!validInt(body.percent, 0, 90)) return Response.json({ error: "نسبة الخصم يجب أن تكون بين 0 و90%" }, { status: 400 });
    // Existing menu price badges and checkout already read item.discountPct.
    // Applying to every current item keeps those surfaces correct without changing customer/store pages.
    const changed = await db.update(t.items).set({ discountPct: body.percent as number })
      .where(eq(t.items.storeId, storeId)).returning({ id: t.items.id });
    return Response.json({ ok: true, affected: changed.length, percent: body.percent });
  }
  if (body.action === "item") {
    const parsed = await validateItem(body, storeId, db);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
    const { sizes, addons, ...values } = parsed.value;
    const result = await db.transaction(async (tx) => {
      const [item] = await tx.insert(t.items).values({ ...values, storeId }).returning();
      if (sizes.length) await tx.insert(t.itemSizes).values(sizes.map((size) => ({ itemId: item.id, ...size })));
      if (addons.length) await tx.insert(t.itemAddons).values(addons.map((addon) => ({ itemId: item.id, ...addon })));
      return item;
    });
    return Response.json(result, { status: 201 });
  }
  return Response.json({ error: "إجراء غير معروف" }, { status: 400 });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const storeId = await authorize(ctx);
  if (!storeId) return Response.json({ error: "لا تملك صلاحية لإدارة القائمة" }, { status: 403 });
  const db = await getDb();
  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: "معرّف غير صالح" }, { status: 400 });
  if (body.action === "category") {
    const nameAr = typeof body.nameAr === "string" ? body.nameAr.trim() : "";
    const nameEn = typeof body.nameEn === "string" ? body.nameEn.trim() : "";
    if (!nameAr || nameAr.length > 100 || nameEn.length > 100) return Response.json({ error: "اسم القسم غير صالح" }, { status: 400 });
    const [category] = await db.update(t.categories).set({ nameAr, nameEn: nameEn || null })
      .where(and(eq(t.categories.id, id), eq(t.categories.storeId, storeId))).returning();
    return Response.json(category ?? { error: "القسم غير موجود" }, { status: category ? 200 : 404 });
  }
  if (body.action === "item") {
    const [old] = await db.select().from(t.items).where(and(eq(t.items.id, id), eq(t.items.storeId, storeId))).limit(1);
    if (!old) return Response.json({ error: "الصنف غير موجود في هذا المطعم" }, { status: 404 });
    const parsed = await validateItem(body, storeId, db);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
    const { sizes, addons, ...values } = parsed.value;
    const updated = await db.transaction(async (tx) => {
      const [item] = await tx.update(t.items).set(values)
        .where(and(eq(t.items.id, id), eq(t.items.storeId, storeId))).returning();
      if (!item) return null;
      // A pending owner price request must never override a later admin edit.
      await tx.update(t.priceRequests).set({ status: "rejected", adminNote: "الصنف عُدّل مباشرة من لوحة الإدارة" })
        .where(and(eq(t.priceRequests.itemId, id), eq(t.priceRequests.status, "pending")));
      await tx.delete(t.itemSizes).where(eq(t.itemSizes.itemId, id));
      await tx.delete(t.itemAddons).where(eq(t.itemAddons.itemId, id));
      if (sizes.length) await tx.insert(t.itemSizes).values(sizes.map((size) => ({ itemId: id, ...size })));
      if (addons.length) await tx.insert(t.itemAddons).values(addons.map((addon) => ({ itemId: id, ...addon })));
      return item;
    });
    return Response.json(updated ?? { error: "الصنف غير موجود" }, { status: updated ? 200 : 404 });
  }
  return Response.json({ error: "إجراء غير معروف" }, { status: 400 });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const storeId = await authorize(ctx);
  if (!storeId) return Response.json({ error: "لا تملك صلاحية لإدارة القائمة" }, { status: 403 });
  const db = await getDb();
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  const type = url.searchParams.get("type");
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: "معرّف غير صالح" }, { status: 400 });
  if (type === "item") {
    const [deleted] = await db.delete(t.items).where(and(eq(t.items.id, id), eq(t.items.storeId, storeId))).returning({ id: t.items.id });
    return Response.json(deleted ? { ok: true } : { error: "الصنف غير موجود" }, { status: deleted ? 200 : 404 });
  }
  if (type === "category") {
    const [deleted] = await db.delete(t.categories).where(and(eq(t.categories.id, id), eq(t.categories.storeId, storeId))).returning({ id: t.categories.id });
    return Response.json(deleted ? { ok: true } : { error: "القسم غير موجود" }, { status: deleted ? 200 : 404 });
  }
  return Response.json({ error: "نوع الحذف غير معروف" }, { status: 400 });
}
