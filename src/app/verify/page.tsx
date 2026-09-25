import Link from "next/link";
import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { brandFrom } from "@/lib/brand";
import { VerifyEmail } from "@/components/verify-email";

export const dynamic = "force-dynamic";
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ role?: string; token?: string }> }) {
  const params = await searchParams;
  const db = await getDb();
  const brand = brandFrom(await db.select().from(t.settings));
  return <VerifyEmail role={params.role === "driver" ? "driver" : "customer"} token={params.token || ""} logoOverride={brand.logoUrl || undefined} />;
}
