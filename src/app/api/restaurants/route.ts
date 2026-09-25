import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { and, eq, ilike, or } from "drizzle-orm";
import { effectiveStoreStatus } from "@/lib/working-hours";

export async function GET(req: Request) {
  const db = await getDb();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const cuisine = url.searchParams.get("cuisine")?.trim();
  const areaId = url.searchParams.get("area");

  const rows = await db
    .select({
      store: t.stores,
      areaName: t.areas.nameAr,
      govName: t.governorates.nameAr,
    })
    .from(t.stores)
    .leftJoin(t.areas, eq(t.stores.areaId, t.areas.id))
    .leftJoin(t.governorates, eq(t.areas.governorateId, t.governorates.id))
    .where(
      and(
        eq(t.stores.approved, true),
        eq(t.stores.banned, false),
        q ? or(ilike(t.stores.nameAr, `%${q}%`), ilike(t.stores.cuisine, `%${q}%`)) : undefined,
        cuisine ? eq(t.stores.cuisine, cuisine) : undefined,
        areaId ? eq(t.stores.areaId, Number(areaId)) : undefined,
      ),
    );

  return Response.json(
    rows.map((r) => ({
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
    })),
  );
}
