import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { brandFrom } from "@/lib/brand";
import { ConsoleLogin } from "@/components/console-login";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AdminLogin() {
  const db = await getDb();
  const brand = brandFrom(await db.select().from(t.settings));
  const [owner] = await db.select({ id: t.admins.id }).from(t.admins).where(eq(t.admins.username, "moosameftah")).limit(1);
  return <ConsoleLogin role="admin" brand={brand} logoOverride={brand.logoUrl || undefined} title="مركز تحكم لقمة" subtitle="كل شيء في مكان واحد، تحت سيطرتك" useUsername backHref="/" setupPending={!owner} adminUsername="moosameftah" />;
}
