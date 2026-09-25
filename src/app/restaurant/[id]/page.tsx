import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { brandFrom } from "@/lib/brand";
import { getSession } from "@/lib/auth";
import { effectiveStoreStatus } from "@/lib/working-hours";
import { RestaurantView } from "@/components/customer-restaurant";
import type { GovOpt } from "@/components/customer-home";

export const dynamic = "force-dynamic";

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getDb();
  const settingsRows = await db.select().from(t.settings);
  const brand = brandFrom(settingsRows);
  const storeId = Number(id);

  const [store] = await db.select().from(t.stores).where(eq(t.stores.id, storeId));
  if (!store) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <p className="font-display text-2xl font-extrabold text-[#2A0A4A]">المتجر غير موجود</p>
      </div>
    );
  }

  const govs = await db.select().from(t.governorates).orderBy(asc(t.governorates.id));
  const areaRows = await db.select().from(t.areas).orderBy(asc(t.areas.nameAr));
  const gov: GovOpt[] = govs.map((g) => ({
    id: g.id,
    nameAr: g.nameAr,
    areas: areaRows
      .filter((a) => a.governorateId === g.id)
      .map((a) => ({ id: a.id, nameAr: a.nameAr, deliveryFeeFils: a.deliveryFeeFils })),
  }));

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
    .where(eq(t.reviews.storeId, storeId));

  const sess = await getSession("customer");

  return (
    <RestaurantView
      brand={brand}
      logoOverride={brand.logoUrl || undefined}
      userName={sess?.name ?? null}
      gov={gov}
      store={{
        id: store.id,
        nameAr: store.nameAr,
        nameEn: store.nameEn,
        cuisine: store.cuisine,
        description: store.description,
        image: store.image,
        status: effectiveStoreStatus(store.status, store.workingHours),
        workingHours: store.workingHours,
        minOrderFils: store.minOrderFils,
        address: store.address,
        rating: store.ratingCount ? Math.round((store.ratingSum / store.ratingCount) * 10) / 10 : null,
        ratingCount: store.ratingCount,
      }}
      categories={cats}
      items={items.map((i) => ({
        id: i.id,
        categoryId: i.categoryId,
        nameAr: i.nameAr,
        description: i.description,
        image: i.image,
        priceFils: i.priceFils,
        discountPct: i.discountPct,
        available: i.available,
        sizes: sizes.filter((s) => s.itemId === i.id),
        addons: addons.filter((a) => a.itemId === i.id),
      }))}
      reviews={reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: String(r.createdAt),
        name: r.name,
      }))}
    />
  );
}
