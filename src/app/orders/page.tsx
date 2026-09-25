import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { brandFrom } from "@/lib/brand";
import { getSession } from "@/lib/auth";
import { OrdersView } from "@/components/customer-orders";
import type { GovOpt } from "@/components/customer-home";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const db = await getDb();
  const brand = brandFrom(await db.select().from(t.settings));
  const govs = await db.select().from(t.governorates).orderBy(asc(t.governorates.id));
  const areaRows = await db.select().from(t.areas).orderBy(asc(t.areas.nameAr));
  const gov: GovOpt[] = govs.map((g) => ({
    id: g.id,
    nameAr: g.nameAr,
    areas: areaRows
      .filter((a) => a.governorateId === g.id)
      .map((a) => ({ id: a.id, nameAr: a.nameAr, deliveryFeeFils: a.deliveryFeeFils })),
  }));
  const sess = await getSession("customer");

  return (
    <OrdersView
      brand={brand}
      logoOverride={brand.logoUrl || undefined}
      userName={sess?.name ?? null}
      gov={gov}
    />
  );
}
