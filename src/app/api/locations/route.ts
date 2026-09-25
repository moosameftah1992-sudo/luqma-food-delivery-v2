import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  const db = await getDb();
  const govs = await db.select().from(t.governorates).where(eq(t.governorates.active, true)).orderBy(asc(t.governorates.id));
  const areas = await db.select().from(t.areas).where(eq(t.areas.active, true)).orderBy(asc(t.areas.nameAr));
  return Response.json({
    governorates: govs.map((g) => ({
      id: g.id,
      nameAr: g.nameAr,
      nameEn: g.nameEn,
      areas: areas
        .filter((a) => a.governorateId === g.id)
        .map((a) => ({
          id: a.id,
          nameAr: a.nameAr,
          nameEn: a.nameEn,
          deliveryFeeFils: a.deliveryFeeFils,
        })),
    })),
  });
}
