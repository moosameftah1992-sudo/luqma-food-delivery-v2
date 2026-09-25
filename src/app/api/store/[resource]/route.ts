import { aggregate, groupFor, resolveRange } from "@/lib/reports";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "@/lib/sdb";
import { getSession } from "@/lib/auth";
import { num } from "@/lib/util";
import { parseWorkingHours } from "@/lib/working-hours";

export async function GET(req: Request) {
  const db = await getDb();
  const sess = await getSession();
  if (!sess) return Response.json({ error: "غير مصرّح" }, { status: 401 });
  const url = new URL(req.url);
  const resource = resourceOf(url);

  if (resource === "items") {
    const storeId = await storeIdOf(sess);
    if (!storeId) return deny();
    const items = await db.select().from(t.items).where(eq(t.items.storeId, storeId)).orderBy(asc(t.items.sortOrder), asc(t.items.id));
    const sizes = await db.select().from(t.itemSizes);
    const addons = await db.select().from(t.itemAddons);
    return Response.json(
      items.map((i) => ({
        ...i,
        sizes: sizes.filter((s) => s.itemId === i.id),
        addons: addons.filter((a) => a.itemId === i.id),
      })),
    );
  }

  if (resource === "categories") {
    const storeId = await storeIdOf(sess);
    if (!storeId) return deny();
    const cats = await db.select().from(t.categories).where(eq(t.categories.storeId, storeId)).orderBy(asc(t.categories.sortOrder));
    return Response.json(cats);
  }

  if (resource === "discounts") {
    const storeId = await storeIdOf(sess);
    if (!storeId) return deny();
    return Response.json(
      await db.select().from(t.discounts).where(eq(t.discounts.storeId, storeId)).orderBy(desc(t.discounts.id)),
    );
  }

  if (resource === "price-requests") {
    const storeId = await storeIdOf(sess);
    if (!storeId) return deny();
    return Response.json(
      await db.select().from(t.priceRequests).where(eq(t.priceRequests.storeId, storeId)).orderBy(desc(t.priceRequests.id)),
    );
  }

  if (resource === "profile") {
    const storeId = await storeIdOf(sess);
    if (!storeId) return deny();
    const [store] = await db.select().from(t.stores).where(eq(t.stores.id, storeId));
    if (!store) return Response.json({ error: "المتجر غير موجود" }, { status: 404 });
    return Response.json({ ...store, passwordHash: undefined });
  }

  if (resource === "reports") {
    const storeId = await storeIdOf(sess);
    if (!storeId) return deny();
    const preset = url.searchParams.get("preset") || "daily";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const range = resolveRange(preset, from, to);
    const rows = await db
      .select()
      .from(t.orders)
      .where(
        and(
          eq(t.orders.storeId, storeId),
          gte(t.orders.placedAt, range.from),
          lte(t.orders.placedAt, range.to),
        ),
      )
      .orderBy(asc(t.orders.placedAt));
    const g = (url.searchParams.get("group") || groupFor(preset)) as "day" | "week" | "month";
    return Response.json(aggregate(rows, g, "store"));
  }

  return Response.json({ error: "مورد غير معروف" }, { status: 404 });
}

export async function POST(req: Request) {
  const db = await getDb();
  const sess = await getSession();
  if (!sess) return Response.json({ error: "غير مصرّح" }, { status: 401 });
  const url = new URL(req.url);
  const resource = resourceOf(url);
  const body = await req.json().catch(() => ({}));
  const storeId = await storeIdOf(sess);
  if (!storeId) return deny();

  if (resource === "categories") {
    const [c] = await db
      .insert(t.categories)
      .values({ storeId, nameAr: String(body.nameAr || ""), sortOrder: num(body.sortOrder) })
      .returning();
    return Response.json(c);
  }

  if (resource === "items") {
    const [item] = await db
      .insert(t.items)
      .values({
        storeId,
        categoryId: body.categoryId ? num(body.categoryId) : null,
        nameAr: String(body.nameAr || ""),
        description: String(body.description || ""),
        image: String(body.image || ""),
        priceFils: num(body.priceFils),
        discountPct: num(body.discountPct),
        available: body.available !== false,
      })
      .returning();
    if (Array.isArray(body.sizes) && body.sizes.length)
      await db.insert(t.itemSizes).values(
        body.sizes.map((s: { nameAr: string; priceFils: number }) => ({
          itemId: item.id,
          nameAr: String(s.nameAr),
          priceFils: num(s.priceFils),
        })),
      );
    if (Array.isArray(body.addons) && body.addons.length)
      await db.insert(t.itemAddons).values(
        body.addons.map((a: { nameAr: string; priceFils: number }) => ({
          itemId: item.id,
          nameAr: String(a.nameAr),
          priceFils: num(a.priceFils),
        })),
      );
    return Response.json(item);
  }

  if (resource === "discounts") {
    const [d] = await db
      .insert(t.discounts)
      .values({
        storeId,
        code: String(body.code || "").toUpperCase(),
        percent: Math.min(90, Math.max(1, num(body.percent, 10))),
        active: body.active !== false,
      })
      .returning();
    return Response.json(d);
  }

  if (resource === "price-requests") {
    const [r] = await db
      .insert(t.priceRequests)
      .values({
        storeId,
        itemId: body.itemId ? num(body.itemId) : null,
        sizeId: body.sizeId ? num(body.sizeId) : null,
        target: String(body.target || "item"),
        targetName: String(body.targetName || ""),
        oldPriceFils: num(body.oldPriceFils),
        newPriceFils: num(body.newPriceFils),
      })
      .returning();
    return Response.json(r);
  }

  if (resource === "profile") {
    if (body.status !== undefined && !["open", "busy", "closed"].includes(body.status))
      return Response.json({ error: "حالة المتجر غير صالحة" }, { status: 400 });
    const hours = body.workingHours !== undefined ? parseWorkingHours(body.workingHours) : null;
    if (hours && !hours.ok) return Response.json({ error: hours.error }, { status: 400 });
    const [u] = await db
      .update(t.stores)
      .set({
        status: body.status !== undefined ? body.status : undefined,
        workingHours: hours?.ok ? hours.periods : undefined,
        description: body.description !== undefined ? String(body.description) : undefined,
        minOrderFils: body.minOrderFils !== undefined ? num(body.minOrderFils) : undefined,
        image: body.image !== undefined ? String(body.image) : undefined,
      })
      .where(eq(t.stores.id, storeId))
      .returning();
    if (!u) return Response.json({ error: "المتجر غير موجود" }, { status: 404 });
    return Response.json({ ...u, passwordHash: undefined });
  }

  return Response.json({ error: "مورد غير معروف" }, { status: 404 });
}


function resourceOf(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1];
}

async function storeIdOf(sess: { role: string; id: number }) {
  return sess.role === "store" ? sess.id : null;
}

function deny() {
  return Response.json({ error: "غير مصرّح" }, { status: 403 });
}

