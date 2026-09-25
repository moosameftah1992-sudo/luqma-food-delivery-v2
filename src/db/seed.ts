import { db } from "@/db";
import * as t from "@/db/schema";
import { createSchemaIfMissing } from "@/db/bootstrap";
import { hashPassword } from "@/lib/auth";
import { DEFAULTS } from "@/lib/brand";
import { eq, sql } from "drizzle-orm";

type SeedTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const INIT_MARKER = "__luqma_bootstrap_v2";
let initialization: Promise<void> | undefined;

/** Shared promise per process + database advisory lock across serverless workers. */
export function ensureSeeded(): Promise<void> {
  if (!initialization) initialization = initialize().catch((error: unknown) => {
    initialization = undefined;
    console.error("[luqma] bootstrap failed:", error);
    throw error;
  });
  return initialization;
}

async function initialize() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(482719, 1)`);
    await createSchemaIfMissing(tx);
    await seedProductionDefaults(tx);
    await ensureOwner(tx);
  });
}

async function seedProductionDefaults(tx: SeedTransaction) {
  await tx.insert(t.settings)
    .values(Object.entries(DEFAULTS).map(([key, value]) => ({ key, value })))
    .onConflictDoNothing({ target: t.settings.key });
  const [marker] = await tx.select({ key: t.settings.key }).from(t.settings).where(eq(t.settings.key, INIT_MARKER)).limit(1);
  if (marker) return;

  await tx.insert(t.cmsPages).values([
    { slug: "terms", titleAr: "الشروط والأحكام", bodyAr: "باستخدامك تطبيق لقمة فإنك توافق على الدفع بالوسائل المتاحة عند إتمام الطلب، بما في ذلك الدفع الإلكتروني عبر بوابة الدفع أو الدفع النقدي عند الاستلام إن كان مفعلاً من الإدارة. يمكن للعميل إلغاء الطلب خلال 5 دقائق من تأكيده مع ذكر السبب. تواصل مع فريق الدعم للمساعدة." },
    { slug: "privacy", titleAr: "سياسة الخصوصية", bodyAr: "نستخدم بياناتك لتنفيذ طلباتك وتوصيلها. تُعالَج مدفوعاتك على صفحة دفع آمنة مستضافة لدى مزوّد الدفع؛ ولا نتلقى بيانات البطاقة أو رمز التحقق البنكي." },
  ]).onConflictDoNothing({ target: t.cmsPages.slug });

  const [banner] = await tx.select({ id: t.banners.id }).from(t.banners).limit(1);
  if (!banner) await tx.insert(t.banners).values([
    { image: "/images/hero-feast.jpg", titleAr: "من مطبخهم إلى بابك", subtitleAr: "اكتشف مطاعم منطقتك مع لقمة", sortOrder: 0 },
    { image: "/images/driver-night.jpg", titleAr: "توصيل أسرع، راحة أكثر", subtitleAr: "تابع طلبك خطوة بخطوة", sortOrder: 1 },
  ]);

  const [governorate] = await tx.select({ id: t.governorates.id }).from(t.governorates).limit(1);
  if (!governorate) {
    const govs = await tx.insert(t.governorates).values([
      { nameAr: "العاصمة", nameEn: "Capital" },
      { nameAr: "المحرق", nameEn: "Muharraq" },
      { nameAr: "الشمالية", nameEn: "Northern" },
      { nameAr: "الجنوبية", nameEn: "Southern" },
    ]).returning();
    await tx.insert(t.areas).values([
      { governorateId: govs[0].id, nameAr: "المنامة", nameEn: "Manama", deliveryFeeFils: 1500 },
      { governorateId: govs[0].id, nameAr: "الجفير", nameEn: "Juffair", deliveryFeeFils: 1500 },
      { governorateId: govs[0].id, nameAr: "العدلية", nameEn: "Adliya", deliveryFeeFils: 1500 },
      { governorateId: govs[0].id, nameAr: "السيف", nameEn: "Seef", deliveryFeeFils: 1800 },
      { governorateId: govs[1].id, nameAr: "المحرق", nameEn: "Muharraq", deliveryFeeFils: 1500 },
      { governorateId: govs[1].id, nameAr: "عراد", nameEn: "Arad", deliveryFeeFils: 1500 },
      { governorateId: govs[1].id, nameAr: "الحد", nameEn: "Hidd", deliveryFeeFils: 2000 },
      { governorateId: govs[2].id, nameAr: "مدينة حمد", nameEn: "Hamad Town", deliveryFeeFils: 2000 },
      { governorateId: govs[2].id, nameAr: "البديع", nameEn: "Budaiya", deliveryFeeFils: 2500 },
      { governorateId: govs[3].id, nameAr: "الرفاع", nameEn: "Riffa", deliveryFeeFils: 2000 },
      { governorateId: govs[3].id, nameAr: "مدينة عيسى", nameEn: "Isa Town", deliveryFeeFils: 2000 },
    ]);
  }
  await tx.insert(t.settings).values({ key: INIT_MARKER, value: "1" }).onConflictDoNothing({ target: t.settings.key });
}

/** One real owner, never a public/demo password. Existing password is never reset on deploy. */
async function ensureOwner(tx: SeedTransaction) {
  const [owner] = await tx.select().from(t.admins).where(eq(t.admins.username, "moosameftah")).limit(1);
  if (owner) {
    if (owner.status !== "active" || !owner.permissions.includes("all"))
      await tx.update(t.admins).set({ status: "active", permissions: ["all"] }).where(eq(t.admins.id, owner.id));
    return;
  }
  const password = process.env.LUQMA_ADMIN_PASSWORD;
  if (!password || password.length < 16) {
    console.warn("[luqma] Configure LUQMA_ADMIN_PASSWORD (16+ characters) to provision owner moosameftah. No default credentials exist.");
    return;
  }
  const email = process.env.LUQMA_ADMIN_EMAIL?.trim().toLowerCase();
  await tx.insert(t.admins).values({
    username: "moosameftah",
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    passwordHash: hashPassword(password),
    fullName: "moosameftah",
    title: "المالك · صلاحيات كاملة",
    permissions: ["all"],
    status: "active",
  }).onConflictDoNothing({ target: t.admins.username });
}
