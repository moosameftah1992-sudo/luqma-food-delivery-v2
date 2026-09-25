import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { brandFrom } from "@/lib/brand";
import { getSession } from "@/lib/auth";
import { effectiveStoreStatus } from "@/lib/working-hours";
import { CustomerHome, type Banner, type GovOpt, type StoreCard } from "@/components/customer-home";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = await getDb();
  const settingsRows = await db.select().from(t.settings);
  const brand = brandFrom(settingsRows);

  const govs = await db.select().from(t.governorates).where(eq(t.governorates.active, true)).orderBy(asc(t.governorates.id));
  const areaRows = await db.select().from(t.areas).where(eq(t.areas.active, true)).orderBy(asc(t.areas.nameAr));
  const gov: GovOpt[] = govs.map((g) => ({
    id: g.id,
    nameAr: g.nameAr,
    nameEn: g.nameEn,
    areas: areaRows
      .filter((a) => a.governorateId === g.id)
      .map((a) => ({ id: a.id, nameAr: a.nameAr, nameEn: a.nameEn, deliveryFeeFils: a.deliveryFeeFils })),
  }));

  const storeRows = await db
    .select({
      store: t.stores,
      areaName: t.areas.nameAr,
      govName: t.governorates.nameAr,
    })
    .from(t.stores)
    .leftJoin(t.areas, eq(t.stores.areaId, t.areas.id))
    .leftJoin(t.governorates, eq(t.areas.governorateId, t.governorates.id))
    .where(eq(t.stores.approved, true));

  const stores: StoreCard[] = storeRows
    .filter((r) => !r.store.banned)
    .map((r) => ({
      id: r.store.id,
      nameAr: r.store.nameAr,
      nameEn: r.store.nameEn,
      cuisine: r.store.cuisine,
      description: r.store.description,
      image: r.store.image,
      status: effectiveStoreStatus(r.store.status, r.store.workingHours),
      minOrderFils: r.store.minOrderFils,
      rating: r.store.ratingCount
        ? Math.round((r.store.ratingSum / r.store.ratingCount) * 10) / 10
        : null,
      ratingCount: r.store.ratingCount,
      areaName: r.areaName,
      govName: r.govName,
    }));

  const bannerRows = await db.select().from(t.banners).where(eq(t.banners.active, true)).orderBy(asc(t.banners.sortOrder));
  const banners: Banner[] = bannerRows.map((b) => ({
    id: b.id,
    image: b.image,
    titleAr: b.titleAr,
    subtitleAr: b.subtitleAr,
  }));

  const pageRows = await db.select().from(t.cmsPages);
  const sess = await getSession("customer");

  return (
    <CustomerHome
      brand={brand}
      logoOverride={brand.logoUrl || undefined}
      userName={sess?.name ?? null}
      gov={gov}
      stores={stores}
      banners={banners}
      pages={pageRows.map((p) => ({ slug: p.slug, titleAr: p.titleAr }))}
    />
  );
}
