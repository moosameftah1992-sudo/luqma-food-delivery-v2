import { NextResponse } from "next/server";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStoreSession } from "@/lib/auth";

export async function GET() {
  const s = await getStoreSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = (await db.select().from(stores).where(eq(stores.id, s.id)))[0];
  if (!raw) return NextResponse.json({ error: "Store not found" }, { status: 404 });
  return NextResponse.json({ store: { ...raw, passwordHash: undefined } });
}
