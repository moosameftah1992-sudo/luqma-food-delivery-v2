export const DEFAULTS: Record<string, string> = {
  appNameAr: "لقمة",
  appNameEn: "Luqma",
  logoUrl: "",
  tagline: "طلبك من أفضل مطاعم البحرين… بلقمة",
  taglineEn: "Bahrain's best bites, delivered",
  heroTitle: "جوعان؟ لقمة توصّل لك أحلى شي",
  heroTitleEn: "Hungry? Your next favorite bite is on its way.",
  heroSubtitle:
    "مطاعم البحرين المفضلة عندك، تدفع إلكترونياً بالبطاقة أو بنفت باي، ويوصلك الطلب خلال دقائق.",
  heroSubtitleEn: "Discover local favorites. Pay securely by card or BenefitPay and enjoy delivery to your door.",
  supportWhatsapp: "97336119511",
  supportLabel: "دعم واتساب مباشر",
  supportLabelEn: "WhatsApp support",
  currency: "د.ب",
  storeCommissionFils: "500",
  deliveryCommissionPct: "10",
  cancelWindowMin: "5",
  footerNote: "لقمة — منصّة توصيل الطعام في مملكة البحرين",
  footerNoteEn: "Luqma — food delivery across Bahrain",
  navRestaurants: "المطاعم",
  navRestaurantsEn: "Restaurants",
  navOrders: "طلباتي",
  navOrdersEn: "My orders",
  navOffers: "العروض",
  splashText: "لقمة… اللذة توصلك",
  closedNote: "المطعم مغلق حالياً",
};

export type Brand = typeof DEFAULTS;

export function brandFrom(rows: { key: string; value: string }[]): Brand {
  const out: Brand = { ...DEFAULTS };
  for (const r of rows) if (r.key in out) out[r.key] = r.value;
  return out;
}

export function whatsappLink(brand: Brand) {
  const n = (brand.supportWhatsapp || "97336119511").replace(/[^\d]/g, "");
  return `https://wa.me/${n}?text=${encodeURIComponent("مرحباً لقمة، أحتاج مساعدة بخصوص طلبي")}`;
}
