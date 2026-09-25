import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { effectiveStoreStatus } from "@/lib/working-hours";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await getDb();
  const storeId = Number(id);
  const [store] = await db.select().from(t.stores).where(eq(t.stores.id, storeId));
  if (!store) return Response.json({ error: "المتجر غير موجود" }, { status: 404 });
  const { passwordHash: _passwordHash, ...publicStore } = store;

  const cats = await db
    .select()
    .from(t.categories)
    .where(eq(t.categories.storeId, storeId))
    .orderBy(asc(t.categories.sortOrder), asc(t.categories.id));
  const items = await db
    .select()
    .from(t.items)
    .where(eq(t.items.storeId, storeId))
    .orderBy(asc(t.items.sortOrder), asc(t.items.id));
  const sizes = await db.select().from(t.itemSizes);
  const addons = await db.select().from(t.itemAddons);
  const reviews = await db
    .select({
      id: t.reviews.id,
      rating: t.reviews.rating,
      comment: t.reviews.comment,
      createdAt: t.reviews.createdAt,
      name: t.customers.name,
    })
    .from(t.reviews)
    .leftJoin(t.customers, eq(t.reviews.customerId, t.customers.id))
    .where(eq(t.reviews.storeId, storeId))
    .orderBy(asc(t.reviews.id));

  return Response.json({
    store: {
      ...publicStore,
      status: effectiveStoreStatus(store.status, store.workingHours),
      rating: store.ratingCount
        ? Math.round((store.ratingSum / store.ratingCount) * 10) / 10
        : null,
    },
    categories: cats,
    items: items.map((i) => ({
      ...i,
      sizes: sizes.filter((s) => s.itemId === i.id),
      addons: addons.filter((a) => a.itemId === i.id),
    })),
    reviews,
  });
}
