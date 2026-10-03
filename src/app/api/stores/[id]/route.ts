import { NextResponse } from "next/server";
import { db } from "@/db";
import { stores, products, categories, governorates, areas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStoreSession, getAdminSession, hashPassword } from "@/lib/auth";

type StoreId = { params: Promise<{ id: string }> };

async function ownStore(id: number) {
  const s = await getStoreSession();
  return s && s.id === id ? true : false;
}

export async function GET(_req: Request, { params }: StoreId) {
  const { id } = await params;
  const rawStore = (await db.select().from(stores).where(eq(stores.id, Number(id))))[0];
  if (!rawStore) return NextResponse.json({ error: "Store not found" }, { status: 404 });
  const store: any = { ...rawStore, passwordHash: undefined };
  const prods = await db.select().from(products).where(eq(products.storeId, store.id));
  const cats = await db.select().from(categories);
  const gov = (await db.select().from(governorates)).find((g) => g.id === store.governorateId);
  const area = store.areaId ? (await db.select().from(areas)).find((a) => a.id === store.areaId) : null;
  return NextResponse.json({
    store: { ...store, governorate: gov?.nameAr, area: area?.nameAr },
    products: prods,
    categories: cats,
  });
}

export async function PUT(req: Request, { params }: StoreId) {
  const { id } = await params;
  const admin = await getAdminSession();
  const isOwner = await ownStore(Number(id));
  if (!admin && !isOwner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json();
  const fields: Record<string, unknown> = {};
  const allowed = ["nameAr", "nameEn", "description", "logoUrl", "bannerUrl", "status", "discountPercent", "pinned", "approved", "workingHours", "categoryId", "governorateId", "areaId"];
  for (const k of allowed) if (k in b) fields[k] = b[k];
  if ("deliveryFee" in b) fields.deliveryFee = Number(b.deliveryFee) || 0;
  if ("minOrder" in b) fields.minOrder = Number(b.minOrder) || 0;
  if ("password" in b && b.password && admin) fields.passwordHash = hashPassword(b.password);
  if ("email" in b && b.email && admin) fields.email = b.email;
  if ("phone" in b && b.phone !== undefined) fields.phone = b.phone;
  if ("ownerName" in b && b.ownerName !== undefined) fields.ownerName = b.ownerName;

  const [updated] = await db.update(stores).set(fields).where(eq(stores.id, Number(id))).returning();
  return NextResponse.json({ ok: true, store: updated });
}

export async function DELETE(_req: Request, { params }: StoreId) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.delete(stores).where(eq(stores.id, Number(id)));
  return NextResponse.json({ ok: true });
}
