import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { brandFrom } from "@/lib/brand";
import { DriverApp } from "@/components/driver-dashboard";

export const dynamic = "force-dynamic";

export default async function DriverPage() {
  const db = await getDb();
  const brand = brandFrom(await db.select().from(t.settings));
  return <DriverApp brand={brand} logoOverride={brand.logoUrl || undefined} />;
}
