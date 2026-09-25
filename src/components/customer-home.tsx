"use client";

import Link from "next/link";
import { Gift } from "lucide-react";
import { LanguageSwitch, useLocale } from "@/components/locale-provider";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/brand";
import { Btn, Pill } from "@/components/ui";
import { cartCount, readCart, type Cart } from "@/lib/cart";
import { cn, fmtFils } from "@/lib/util";
import { whatsappLink, type Brand } from "@/lib/brand";

export type AreaOpt = { id: number; nameAr: string; nameEn?: string | null; deliveryFeeFils: number };
export type GovOpt = { id: number; nameAr: string; nameEn?: string | null; areas: AreaOpt[] };
export type StoreCard = {
  id: number;
  nameAr: string;
  nameEn: string | null;
  cuisine: string;
  description: string;
  image: string;
  status: string;
  minOrderFils: number;
  rating: number | null;
  ratingCount: number;
  areaName: string | null;
  govName: string | null;
};
export type Banner = { id: number; image: string; titleAr: string; subtitleAr: string };

const AR_INDEX = ["٠١", "٠٢", "٠٣", "٠٤", "٠٥", "٠٦", "٠٧", "٠٨", "٠٩", "١٠", "١١", "١٢"];

export function CustomerChrome({
  brand,
  logoOverride,
  userName,
  children,
  bare,
}: {
  brand: Brand;
  logoOverride?: string;
  userName?: string | null;
  children: React.ReactNode;
  bare?: boolean;
}) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [bonusBalanceFils, setBonusBalanceFils] = useState(0);
  const { tr } = useLocale();
  useEffect(() => {
    if (!userName) return;
    const controller = new AbortController();
    fetch("/api/payments/config", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => { if (payload && !controller.signal.aborted) setBonusBalanceFils(Math.max(0, Number(payload.bonusBalanceFils) || 0)); })
      .catch(() => {});
    return () => controller.abort();
  }, [userName]);
  useEffect(() => {
    setCart(readCart());
    const h = () => setCart(readCart());
    window.addEventListener("luqma:cart", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("luqma:cart", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  const count = cartCount(cart);

  return (
    <div className="min-h-screen bg-paper pb-20">
      <header className="sticky top-0 z-40 border-b border-[#2A0A4A]/10 bg-[#2A0A4A]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6 md:flex-nowrap">
          <Link href="/" className="shrink-0">
            <Logo size={38} tone="light" override={logoOverride} />
          </Link>
          <nav className="mr-4 hidden items-center gap-5 text-sm font-bold text-white/75 lg:flex">
            <Link href="/" className="transition hover:text-[#FDBA21]">
              {brand.navRestaurants}
            </Link>
            <Link href="/orders" className="transition hover:text-[#FDBA21]">
              {brand.navOrders}
            </Link>
            <Link href="/page/terms" className="transition hover:text-[#FDBA21]">
              الشروط والأحكام
            </Link>
            <Link href="/store/login" className="transition hover:text-[#FDBA21]">
              لوحة المتاجر
            </Link>
            <Link href="/driver" className="transition hover:text-[#FDBA21]">
              مندوبي التوصيل
            </Link>
          </nav>
          <div className="flex w-full items-center justify-between gap-2 md:w-auto md:flex-1 md:justify-end">
            <LanguageSwitch />
            {userName && bonusBalanceFils > 0 && (
              <Link href="/checkout" title={tr("رصيد البونس الخاص بك", "Your bonus balance")} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#FDBA21]/45 bg-[#FDBA21]/10 px-2 py-1.5 text-[11px] font-extrabold text-[#FDBA21] sm:px-3 sm:text-xs">
                <Gift size={14} />
                <span>{tr("بونس", "Bonus")}</span>
                <span dir="ltr">{fmtFils(bonusBalanceFils)}</span>
              </Link>
            )}
            <Link
              href="/checkout"
              className="relative rounded-xl bg-white/8 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/15"
            >
              🛒 السلة
              {count > 0 && (
                <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#FDBA21] px-1 text-[11px] font-extrabold text-[#2A0A4A]">
                  {count}
                </span>
              )}
            </Link>
            {userName ? (
              <span className="hidden rounded-xl bg-[#FDBA21] px-3 py-2 text-sm font-extrabold text-[#2A0A4A] sm:block">
                {userName}
              </span>
            ) : (
              <Link
                href="/auth"
                className="shrink-0 rounded-xl bg-gradient-to-l from-[#FF6A00] to-[#FDBA21] px-3 py-2 text-xs font-extrabold text-[#2A0A4A] sm:px-4 sm:text-sm"
              >
                <span className="sm:hidden">دخول العميل</span>
                <span className="hidden sm:inline">دخول / حساب جديد</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {children}

      {!bare && (
        <a
          href={whatsappLink(brand)}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-3 bg-[#2A0A4A] px-4 py-2.5 text-sm font-bold text-white shadow-[0_-10px_30px_-18px_rgba(27,7,51,0.9)]"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#2FA36B] text-white">✆</span>
          <span>{brand.supportLabel}</span>
          <span className="text-[#FDBA21] tabular-nums" dir="ltr">
            +{brand.supportWhatsapp}
          </span>
        </a>
      )}
    </div>
  );
}

export function CustomerHome({
  brand,
  logoOverride,
  userName,
  gov,
  stores,
  banners,
  pages,
}: {
  brand: Brand;
  logoOverride?: string;
  userName?: string | null;
  gov: GovOpt[];
  stores: StoreCard[];
  banners: Banner[];
  pages: { slug: string; titleAr: string }[];
}) {
  const [govId, setGovId] = useState<number | null>(gov[0]?.id ?? null);
  const [areaId, setAreaId] = useState<number | null>(null);
  const [cuisine, setCuisine] = useState<string>("");
  const [q, setQ] = useState("");

  const areas = gov.find((g) => g.id === govId)?.areas ?? [];
  const cuisines = useMemo(
    () => [...new Set(stores.map((s) => s.cuisine))],
    [stores],
  );

  const filtered = stores.filter((s) => {
    if (areaId && s.areaName !== areas.find((a) => a.id === areaId)?.nameAr) return false;
    else if (!areaId && govId) {
      const inGov = gov.find((g) => g.id === govId)?.areas.some((a) => a.nameAr === s.areaName);
      if (!inGov) return false;
    }
    if (cuisine && s.cuisine !== cuisine) return false;
    if (q && !`${s.nameAr} ${s.cuisine} ${s.description}`.includes(q)) return false;
    return true;
  });

  return (
    <CustomerChrome brand={brand} logoOverride={logoOverride} userName={userName}>
      {/* hero — full bleed photograph with an off-centre RTL type block */}
      <section className="relative isolate overflow-hidden bg-[#1B0733]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-feast.jpg"
          alt="مائدة مشاوي بحرينية"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-[#1B0733]/25 via-[#1B0733]/70 to-[#1B0733]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl rise-in">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.34em] text-[#FDBA21]">
              {brand.tagline}
            </p>
            <h1 className="mt-4 font-display text-5xl font-extrabold leading-[0.95] text-white sm:text-7xl">
              {brand.heroTitle}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
              {brand.heroSubtitle}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="#restaurants">
                <Btn variant="gold" className="px-6 py-3 text-base">
                  تصفح المطاعم
                </Btn>
              </Link>
              <Pill className="border-white/25 bg-white/8 text-white/80">
                💳 اختر وسيلة الدفع المتاحة عند إتمام الطلب
              </Pill>
            </div>
          </div>
        </div>
        <div className="rule-gold h-1 w-full" />
      </section>

      {/* the rail: sticky location + cuisine selector on the RTL start edge */}
      <main
        id="restaurants"
        className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[300px_1fr]"
      >
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-2xl border border-[#2A0A4A]/10 bg-white p-5 shadow-[0_18px_50px_-40px_rgba(42,10,74,0.6)]">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#B4520A]">
              موقع التوصيل
            </p>
            <select
              value={govId ?? ""}
              onChange={(e) => {
                setGovId(Number(e.target.value));
                setAreaId(null);
              }}
              className="mt-3 w-full rounded-xl border border-[#2A0A4A]/15 bg-paper px-3 py-2.5 text-sm font-bold outline-none focus:border-[#FDBA21]"
            >
              {gov.map((g) => (
                <option key={g.id} value={g.id}>
                  محافظة {g.nameAr}
                </option>
              ))}
            </select>
            <select
              value={areaId ?? ""}
              onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : null)}
              className="mt-2 w-full rounded-xl border border-[#2A0A4A]/15 bg-paper px-3 py-2.5 text-sm font-bold outline-none focus:border-[#FDBA21]"
            >
              <option value="">كل المناطق</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nameAr} — رسوم {fmtFils(a.deliveryFeeFils)}
                </option>
              ))}
            </select>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن مطعم أو مطبخ…"
              className="mt-2 w-full rounded-xl border border-[#2A0A4A]/15 bg-paper px-3 py-2.5 text-sm outline-none placeholder:text-[#6B5E7A]/60 focus:border-[#FDBA21]"
            />

            <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#6B5E7A]">
              المطابخ
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setCuisine("")}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                  cuisine === ""
                    ? "border-[#2A0A4A] bg-[#2A0A4A] text-white"
                    : "border-[#2A0A4A]/15 text-[#6B5E7A] hover:border-[#2A0A4A]",
                )}
              >
                الكل
              </button>
              {cuisines.map((c) => (
                <button
                  key={c}
                  onClick={() => setCuisine(c)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                    cuisine === c
                      ? "border-[#2A0A4A] bg-[#2A0A4A] text-white"
                      : "border-[#2A0A4A]/15 text-[#6B5E7A] hover:border-[#2A0A4A]",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="mt-6 border-t border-[#2A0A4A]/10 pt-4 text-xs leading-relaxed text-[#6B5E7A]">
              الإلغاء متاح خلال {brand.cancelWindowMin} دقائق من تأكيد الطلب. جميع المبالغ
              بالدينار البحريني (د.ب).
            </div>
          </div>
        </aside>

        <section>
          <div className="flex items-end justify-between gap-4 border-b-2 border-[#2A0A4A] pb-3">
            <h2 className="font-display text-3xl font-extrabold text-[#2A0A4A]">
              مطاعم {gov.find((g) => g.id === govId)?.nameAr ?? "البحرين"}
            </h2>
            <span className="text-sm font-bold text-[#6B5E7A] tabular-nums">
              {filtered.length} مطعم
            </span>
          </div>

          <ul>
            {filtered.map((s, i) => (
              <li key={s.id}>
                <Link
                  href={`/restaurant/${s.id}`}
                  className="group grid grid-cols-[auto_1fr] items-center gap-4 border-b border-[#2A0A4A]/10 py-5 transition hover:bg-white sm:grid-cols-[auto_180px_1fr] sm:gap-6"
                >
                  <span className="font-display text-3xl font-extrabold text-[#2A0A4A]/25 tabular-nums transition group-hover:text-[#FF7A00]">
                    {AR_INDEX[i] ?? i + 1}
                  </span>
                  <div className="relative h-28 w-full overflow-hidden rounded-xl bg-[#2A0A4A] sm:h-24">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.image}
                      alt={s.nameAr}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1B0733]/55 to-transparent" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl font-extrabold text-[#2A0A4A]">
                        {s.nameAr}
                      </h3>
                      <StatusPill status={s.status} />
                    </div>
                    <p className="mt-1 text-sm text-[#6B5E7A]">
                      {s.cuisine} · {s.govName} / {s.areaName}
                    </p>
                    <p className="mt-1 line-clamp-1 text-sm text-[#2B2433]/70">{s.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-bold text-[#6B5E7A]">
                      <span className="text-[#B4520A]">
                        ★ {s.rating ? s.rating.toFixed(1) : "جديد"}{" "}
                        <span className="font-normal">({s.ratingCount} تقييم)</span>
                      </span>
                      <span>أقل طلب {fmtFils(s.minOrderFils)}</span>
                      <span className="text-[#2A0A4A] group-hover:text-[#FF7A00]">
                        افتح القائمة ←
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {!filtered.length && (
            <p className="rounded-2xl border border-dashed border-[#2A0A4A]/20 p-10 text-center text-sm text-[#6B5E7A]">
              لا توجد مطاعم مطابقة لهذا الفلتر — جرّب محافظة أو مطبخاً آخر.
            </p>
          )}

          {!!banners.length && (
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {banners.map((b) => (
                <div
                  key={b.id}
                  className="relative isolate h-44 overflow-hidden rounded-2xl bg-[#1B0733]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.image}
                    alt={b.titleAr}
                    className="absolute inset-0 h-full w-full object-cover opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1B0733] via-[#1B0733]/55 to-transparent" />
                  <div className="relative flex h-full flex-col justify-end p-4">
                    <p className="font-display text-lg font-extrabold text-white">{b.titleAr}</p>
                    <p className="text-xs text-white/70">{b.subtitleAr}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="mt-8 bg-[#2A0A4A] pb-16 pt-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <Logo size={40} tone="light" override={logoOverride} />
          <div className="flex flex-wrap gap-4 text-sm text-white/65">
            {pages.map((p) => (
              <Link key={p.slug} href={`/page/${p.slug}`} className="hover:text-[#FDBA21]">
                {p.titleAr}
              </Link>
            ))}
            <Link href="/store/login" className="hover:text-[#FDBA21]">
              انضم كمتجر
            </Link>
            <Link href="/driver" className="hover:text-[#FDBA21]">
              انضم كمندوب
            </Link>
            <Link href="/admin/login" className="text-white/50 transition hover:text-[#FDBA21]">
              دخول إدارة لقمة
            </Link>
          </div>
          <p className="text-xs text-white/45">{brand.footerNote}</p>
        </div>
      </footer>
    </CustomerChrome>
  );
}

export function StatusPill({ status }: { status: string }) {
  const { tr } = useLocale();
  const map: Record<string, { ar: string; en: string; cls: string }> = {
    open: { ar: "مفتوح", en: "Open", cls: "border-[#2FA36B]/50 bg-[#2FA36B]/12 text-[#1E6E48]" },
    busy: { ar: "مشغول", en: "Busy", cls: "border-[#FDBA21]/60 bg-[#FDBA21]/20 text-[#8A5A00]" },
    closed: { ar: "مغلق", en: "Closed", cls: "border-[#2A0A4A]/20 bg-[#2A0A4A]/8 text-[#6B5E7A]" },
  };
  const s = map[status] ?? map.closed;
  return <Pill className={s.cls}>{tr(s.ar, s.en)}</Pill>;
}
