import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, stores } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getStoreSession, getAdminSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const store = (await db.select().from(stores).where(eq(stores.id, Number(id))))[0];
  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!store.approved) {
    const admin = await getAdminSession();
    const own = await getStoreSession();
    if (!admin && own?.id !== Number(id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await db.select().from(products).where(eq(products.storeId, Number(id))).orderBy(asc(products.id));
  return NextResponse.json({ products: rows });
}

async function guard(id: number) {
  const admin = await getAdminSession();
  if (admin) return true;
  const own = await getStoreSession();
  return !!own && own.id === id;
}

type OptGroup = { name: string; nameEn: string; choices: { name: string; price: number }[] };
const clean = (b: Record<string, unknown>) => ({
  nameAr: String(b.nameAr || ""),
  nameEn: String(b.nameEn || b.nameAr || ""),
  description: String(b.description || ""),
  price: String(Number(b.price) || 0),
  oldPrice: b.oldPrice ? String(Number(b.oldPrice)) : null,
  discountPercent: Number(b.discountPercent) || 0,
  available: b.available !== false,
  images: Array.isArray(b.images) ? (b.images as string[]).map(String) : [],
  options: (Array.isArray(b.options) ? b.options : []) as OptGroup[],
  categoryId: b.categoryId ? Number(b.categoryId) : null,
});

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!(await guard(Number(id)))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json();
  const [p] = await db.insert(products).values({ storeId: Number(id), ...clean(b) }).returning();
  return NextResponse.json({ ok: true, product: p });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!(await guard(Number(id)))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const pid = Number(url.searchParams.get("productId"));
  const b = await req.json();
  const [p] = await db
    .update(products)
    .set(clean(b))
    .where(and(eq(products.id, pid), eq(products.storeId, Number(id))))
    .returning();
  if (!p) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json({ ok: true, product: p });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!(await guard(Number(id)))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const pid = Number(url.searchParams.get("productId"));
  await db.delete(products).where(and(eq(products.id, pid), eq(products.storeId, Number(id))));
  return NextResponse.json({ ok: true });
}
