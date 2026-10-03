import { NextResponse } from "next/server";
import { db } from "@/db";
import { stores, categories, products } from "@/db/schema";
import { eq, and, asc, desc, sql, isNull } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth";

const PAGE_SIZE = 8;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const catId = url.searchParams.get("category");

  const base = [eq(stores.approved, true)];
  if (q) base.push(sql`${stores.nameAr} ILIKE '%${q}%' OR ${stores.nameEn} ILIKE '%${q}%'`);
  if (catId) base.push(eq(stores.categoryId, Number(catId)));

  const raw = await db
    .select()
    .from(stores)
    .where(and(...base))
    .orderBy(desc(stores.pinned), desc(stores.id));
  const all = raw.map(({ passwordHash, ...rest }: any) => rest);

  const cats = await db.select().from(categories).orderBy(asc(categories.sort));
  const pinned = all.filter((s) => s.pinned);
  const unpinned = all.filter((s) => !s.pinned);

  // Deterministic rotation: rotates every 5 minutes so every store gets visibility
  const window = Math.floor(Date.now() / (5 * 60 * 1000));
  const offset = unpinned.length ? (window * PAGE_SIZE) % unpinned.length : 0;
  const rotated = [...unpinned.slice(offset), ...unpinned.slice(0, offset)];
  const rotating = rotated.slice(0, PAGE_SIZE);

  const deals = all.filter((s) => s.discountPercent > 0);

  return NextResponse.json({
    pinned,
    rotating,
    deals,
    categories: cats,
    all: all.length,
    window,
  });
}

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json();
  const { hashPassword } = await import("@/lib/auth");
  const [s] = await db
    .insert(stores)
    .values({
      nameAr: b.nameAr || "New Store",
      nameEn: b.nameEn || "New Store",
      ownerName: b.ownerName || "",
      email: b.email || `store${Date.now()}@luqma.store`,
      phone: b.phone || "",
      passwordHash: hashPassword(b.password || "Luqma1234!"),
      logoUrl: b.logoUrl || null,
      bannerUrl: b.bannerUrl || null,
      description: b.description || "",
      categoryId: b.categoryId || null,
      governorateId: b.governorateId || null,
      areaId: b.areaId || null,
      approved: b.approved ?? true,
      pinned: b.pinned ?? false,
    })
    .returning();
  return NextResponse.json({ ok: true, store: s });
}
