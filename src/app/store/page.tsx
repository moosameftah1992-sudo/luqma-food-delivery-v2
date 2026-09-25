import { redirect } from "next/navigation";
import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { brandFrom } from "@/lib/brand";
import { getSession } from "@/lib/auth";
import { StoreDashboard } from "@/components/store-dashboard";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const sess = await getSession("store");
  if (!sess) redirect("/store/login");
  const db = await getDb();
  const brand = brandFrom(await db.select().from(t.settings));
  return <StoreDashboard brand={brand} logoOverride={brand.logoUrl || undefined} />;
}
