import { db } from "@/db";
import { cmsSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type Settings = {
  payments: { card: boolean; benefi: boolean; cod: boolean };
  storeCommission: number; // fraction, default 0.5
  deliveryCommission: number; // fraction, default 0.10
  whatsapp: string;
  heroTitleAr: string;
  heroTitleEn: string;
  heroSubAr: string;
  heroSubEn: string;
  heroBadge: string;
  logoUrl: string;
  footerTextAr: string;
  footerTextEn: string;
};

export const DEFAULT_SETTINGS: Settings = {
  payments: { card: true, benefi: true, cod: true },
  storeCommission: 0.5,
  deliveryCommission: 0.1,
  whatsapp: "+97336119511",
  heroTitleAr: "لقمة من طيّب الطعام، تصلك أينما كنت",
  heroTitleEn: "A bite of goodness, delivered wherever you are",
  heroSubAr: "أشهر المطاعم البحرينية على منصة واحدة — اطلب الآن واستمتع بأفضل العروض",
  heroSubEn: "Bahrain's best restaurants on one platform — order now and enjoy live offers",
  heroBadge: "توصيل خلال ٣٠ دقيقة",
  logoUrl: "/images/logo-mark.png",
  footerTextAr: "لقمة — منصة التوصيل الأولى في مملكة البحرين",
  footerTextEn: "Luqma — the leading delivery platform in the Kingdom of Bahrain",
};

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(cmsSettings);
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    out[r.key] = r.value;
  }
  return out;
}

export async function getSettings(): Promise<Settings> {
  const all = await getAllSettings();
  return {
    payments: { ...DEFAULT_SETTINGS.payments, ...(all.payments as object) },
    storeCommission: typeof all.storeCommission === "number" ? (all.storeCommission as number) : DEFAULT_SETTINGS.storeCommission,
    deliveryCommission: typeof all.deliveryCommission === "number" ? (all.deliveryCommission as number) : DEFAULT_SETTINGS.deliveryCommission,
    whatsapp: String(all.whatsapp ?? DEFAULT_SETTINGS.whatsapp),
    heroTitleAr: String(all.heroTitleAr ?? DEFAULT_SETTINGS.heroTitleAr),
    heroTitleEn: String(all.heroTitleEn ?? DEFAULT_SETTINGS.heroTitleEn),
    heroSubAr: String(all.heroSubAr ?? DEFAULT_SETTINGS.heroSubAr),
    heroSubEn: String(all.heroSubEn ?? DEFAULT_SETTINGS.heroSubEn),
    heroBadge: String(all.heroBadge ?? DEFAULT_SETTINGS.heroBadge),
    logoUrl: String(all.logoUrl ?? DEFAULT_SETTINGS.logoUrl),
    footerTextAr: String(all.footerTextAr ?? DEFAULT_SETTINGS.footerTextAr),
    footerTextEn: String(all.footerTextEn ?? DEFAULT_SETTINGS.footerTextEn),
  };
}

export async function setSetting(key: string, value: unknown) {
  const existing = (await db.select().from(cmsSettings).where(eq(cmsSettings.key, key)))[0];
  if (existing) await db.update(cmsSettings).set({ value }).where(eq(cmsSettings.key, key));
  else await db.insert(cmsSettings).values({ key, value });
}
