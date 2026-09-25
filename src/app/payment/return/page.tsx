import { PaymentReturn } from "@/components/payment-return";
import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { brandFrom } from "@/lib/brand";

export const dynamic = "force-dynamic";
export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ order?: string; tap_id?: string }> }) {
  const params = await searchParams;
  const db = await getDb();
  const brand = brandFrom(await db.select().from(t.settings));
  return <PaymentReturn brand={brand} code={params.order || ""} tapId={params.tap_id || ""} />;
}
