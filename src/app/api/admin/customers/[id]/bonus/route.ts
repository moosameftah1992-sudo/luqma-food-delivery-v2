import { and, desc, eq, sql } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "@/lib/sdb";
import { can, getSession } from "@/lib/auth";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

async function authorize(ctx: Ctx) {
  const session = await getSession("admin");
  if (!session || (!can(session, "users") && !can(session, "finance"))) return null;
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return { session, id };
}

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await authorize(ctx);
  if (!auth) return Response.json({ error: "لا تملك صلاحية لعرض رصيد العميل" }, { status: 403 });
  const db = await getDb();
  const [customer] = await db.select({ id: t.customers.id, name: t.customers.name, bonusBalanceFils: t.customers.bonusBalanceFils })
    .from(t.customers).where(eq(t.customers.id, auth.id)).limit(1);
  if (!customer) return Response.json({ error: "العميل غير موجود" }, { status: 404 });
  const entries = await db.select({
    id: t.customerBonuses.id,
    amountFils: t.customerBonuses.amountFils,
    note: t.customerBonuses.note,
    createdAt: t.customerBonuses.createdAt,
    adminName: t.admins.fullName,
  }).from(t.customerBonuses)
    .leftJoin(t.admins, eq(t.customerBonuses.adminId, t.admins.id))
    .where(eq(t.customerBonuses.customerId, auth.id))
    .orderBy(desc(t.customerBonuses.createdAt), desc(t.customerBonuses.id));
  return Response.json({ customer, entries }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await authorize(ctx);
  if (!auth) return Response.json({ error: "لا تملك صلاحية لمنح البونس" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const amountFils = body?.amountFils;
  const note = String(body?.note ?? "").trim();
  if (!Number.isSafeInteger(amountFils) || amountFils < 1 || amountFils > 10_000_000)
    return Response.json({ error: "أدخل مبلغاً صحيحاً بين 0.001 و10,000.000 د.ب" }, { status: 400 });
  if (note.length < 3 || note.length > 250)
    return Response.json({ error: "أدخل سبب المنحة (3 إلى 250 حرفاً)" }, { status: 400 });

  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const [customer] = await tx.update(t.customers)
      .set({ bonusBalanceFils: sql`${t.customers.bonusBalanceFils} + ${amountFils}` })
      .where(eq(t.customers.id, auth.id))
      .returning({ id: t.customers.id, bonusBalanceFils: t.customers.bonusBalanceFils });
    if (!customer) return null;
    const [entry] = await tx.insert(t.customerBonuses).values({
      customerId: auth.id,
      adminId: auth.session.id,
      amountFils,
      note,
    }).returning({ id: t.customerBonuses.id, createdAt: t.customerBonuses.createdAt });
    return { customer, entry };
  });
  if (!result) return Response.json({ error: "العميل غير موجود" }, { status: 404 });
  return Response.json({ ok: true, balanceFils: result.customer.bonusBalanceFils, entry: result.entry }, { status: 201 });
}
