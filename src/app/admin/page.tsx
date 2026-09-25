import { redirect } from "next/navigation";
import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { brandFrom } from "@/lib/brand";
import { getSession } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const sess = await getSession("admin");
  if (!sess) redirect("/admin/login");
  const db = await getDb();
  const brand = brandFrom(await db.select().from(t.settings));
  return (
    <AdminDashboard
      brand={brand}
      logoOverride={brand.logoUrl || undefined}
      perms={sess.perms ?? []}
      adminName={sess.name}
    />
  );
}
