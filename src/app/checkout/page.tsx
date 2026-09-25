import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { brandFrom } from "@/lib/brand";
import { getSession } from "@/lib/auth";
import { CheckoutView } from "@/components/customer-checkout";
import type { GovOpt } from "@/components/customer-home";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const db = await getDb();
  const settingsRows = await db.select().from(t.settings);
  const brand = brandFrom(settingsRows);

  const govs = await db.select().from(t.governorates).where(eq(t.governorates.active, true)).orderBy(asc(t.governorates.id));
  const areaRows = await db.select().from(t.areas).where(eq(t.areas.active, true)).orderBy(asc(t.areas.nameAr));
  const gov: GovOpt[] = govs.map((g) => ({
    id: g.id,
    nameAr: g.nameAr,
    areas: areaRows
      .filter((a) => a.governorateId === g.id)
      .map((a) => ({ id: a.id, nameAr: a.nameAr, deliveryFeeFils: a.deliveryFeeFils })),
  }));

  const sess = await getSession("customer");
  const [me] = sess ? await db.select().from(t.customers).where(eq(t.customers.id, sess.id)) : [null];

  return (
    <CheckoutView
      brand={brand}
      logoOverride={brand.logoUrl || undefined}
      userName={sess?.name ?? null}
      gov={gov}
      defaultAddress={me?.address}
    />
  );
}
