import { eq } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "@/lib/sdb";
import { can, getSession } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession("admin");
  if (!session || !(can(session, "users") || can(session, "operations"))) return Response.json({ error: "غير مصرّح" }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "معرّف غير صالح" }, { status: 400 });
  const db = await getDb();
  const [documents] = await db.select().from(t.driverDocuments).where(eq(t.driverDocuments.driverId, id)).limit(1);
  if (!documents) return Response.json({ error: "لا توجد وثائق" }, { status: 404 });
  return Response.json({ idCardData: documents.idCardData, licenseData: documents.licenseData }, { headers: { "Cache-Control": "no-store, private" } });
}
