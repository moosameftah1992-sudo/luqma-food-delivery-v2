import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { brandFrom } from "@/lib/brand";
import { CustomerAuth } from "@/components/customer-auth";
import type { GovOpt } from "@/components/customer-home";

export const dynamic = "force-dynamic";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const db = await getDb();
  const brand = brandFrom(await db.select().from(t.settings));
  const govs = await db.select().from(t.governorates).where(eq(t.governorates.active, true)).orderBy(asc(t.governorates.id));
  const areaRows = await db.select().from(t.areas).where(eq(t.areas.active, true)).orderBy(asc(t.areas.nameAr));
  const gov: GovOpt[] = govs.map((g) => ({
    id: g.id,
    nameAr: g.nameAr,
    areas: areaRows
      .filter((a) => a.governorateId === g.id)
      .map((a) => ({ id: a.id, nameAr: a.nameAr, deliveryFeeFils: a.deliveryFeeFils })),
  }));

  return (
    <CustomerAuth
      brand={brand}
      logoOverride={brand.logoUrl || undefined}
      gov={gov}
      initialToken={token}
    />
  );
}
