import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { brandFrom } from "@/lib/brand";
import { ConsoleLogin } from "@/components/console-login";

export const dynamic = "force-dynamic";

export default async function StoreLogin() {
  const db = await getDb();
  const brand = brandFrom(await db.select().from(t.settings));
  return <ConsoleLogin role="store" brand={brand} logoOverride={brand.logoUrl || undefined} title="شركاء لقمة" subtitle="طلباتك وقائمتك، بإدارة أسهل" backHref="/" />;
}
