"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header, Footer, WhatsAppFab, StoreCard, Logo, Spinner, Badge } from "@/components/ui";
import { useL, fmtNum } from "@/lib/i18n";

function HomeInner() {
  const { s } = useL();
  const params = useSearchParams();
  const q = params.get("q") || "";
  const cat = params.get("category") || "";
  const [data, setData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState(cat);
  const topRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (catFilter) qs.set("category", catFilter);
    const [sd, cm, au] = await Promise.all([
      fetch(`/api/stores?${qs.toString()}`).then((r) => r.json()),
      fetch("/api/cms").then((r) => r.json()),
      fetch("/api/auth").then((r) => r.json()),
    ]);
    setData(sd);
    setSettings(cm.settings);
    setUser(au.user || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000); // auto-rotate every 5 minutes
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, catFilter]);

  const heroTitle = settings?.heroTitleAr || "لقمة من طيّب الطعام، تصلك أينما كنت";
  const heroSub = settings?.heroSubAr || "أشهر المطاعم على منصة واحدة";
  const heroTitleEn: string = settings?.heroTitleEn || "A bite of goodness, delivered";
  const heroSubEn: string = settings?.heroSubEn || "The best restaurants on one platform";
  const isAr = true; // resolved by useL below
  void isAr;

  const pinned = data?.pinned || [];
  const rotating = data?.rotating || [];
  const deals = data?.deals || [];
  const categories = data?.categories || [];

  const catName = useMemo(() => (id: number) => categories.find((c: any) => c.id === id)?.nameAr, [categories]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-royal-950">
        <div className="flex flex-col items-center gap-4">
          <Logo size={64} />
          <Spinner light />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header user={user} />

      {/* ---------- Hero : balanced, elegant typography ---------- */}
      <section ref={topRef} className="relative overflow-hidden bg-royal-950">
        <div className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(900px 340px at 85% 0%, rgba(247,181,0,0.22), transparent 60%), radial-gradient(700px 300px at 10% 100%, rgba(109,63,160,0.5), transparent 60%)" }} />
        <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-5 px-4 py-12 md:py-16">
          <Badge tone="gold">
            {settings?.heroBadge || "توصيل خلال ٣٠ دقيقة"}
          </Badge>
          <h1 className="max-w-2xl text-2xl font-black leading-relaxed text-white md:text-[34px] md:leading-[1.5]">
            {s(heroTitle, heroTitleEn)}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-white/65 md:text-base">
            {s(heroSub, heroSubEn)}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="#stores" className="rounded-xl bg-gold-500 px-6 py-3 text-sm font-black text-royal-950 shadow-lg shadow-gold-500/30 hover:bg-gold-400 transition">
              {s("اطلب الآن", "Order now")}
            </Link>
            <Link href="#deals" className="rounded-xl border border-white/20 px-6 py-3 text-sm font-bold text-white hover:bg-white/10 transition">
              {s("عروض اليوم", "Today's offers")}
            </Link>
          </div>
        </div>
        <div className="relative border-t border-white/10 bg-white/5">
          <div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 py-3 text-[11px] font-bold text-white/60">
            <span>{s("أكثر من ٦٠ مطعم موثق", "60+ verified restaurants")}</span>
            <span className="text-gold-400">•</span>
            <span>{s("توصيل لمنازلك ومكتبك", "Doorstep & office delivery")}</span>
            <span className="text-gold-400">•</span>
            <span>{s("دفع آمن: بطاقة، BenefitPay أو نقداً", "Secure payment: card, BenefitPay or cash")}</span>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4">
        {/* ---------- Categories ---------- */}
        <section className="mt-8">
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            <button
              onClick={() => setCatFilter("")}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${!catFilter ? "bg-royal-900 text-white" : "bg-white border border-royal-150 text-royal-700 hover:border-royal-400"}`}
            >
              {s("الكل", "All")}
            </button>
            {categories.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setCatFilter(String(c.id))}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${catFilter === String(c.id) ? "bg-royal-900 text-white" : "bg-white border border-royal-150 text-royal-700 hover:border-royal-400"}`}
              >
                {c.nameAr}
              </button>
            ))}
          </div>
        </section>

        {/* ---------- Deals shelf ---------- */}
        {deals.length > 0 && (
          <section id="deals" className="mt-8 scroll-mt-28 rounded-3xl bg-gradient-to-l from-royal-950 to-royal-800 p-5 md:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white md:text-xl">
                  <span className="text-gold-400">✦ </span>
                  {s("عروض وخصومات حصرية", "Exclusive deals & offers")}
                </h2>
                <p className="mt-1 text-xs text-white/55">{s("مطاعم تقدم خصومات على طلبك اليوم", "Restaurants giving you discounts today")}</p>
              </div>
              <Badge tone="gold">{s(`خصم حتى ${Math.max(...deals.map((d: any) => d.discountPercent))}%`, `Up to ${Math.max(...deals.map((d: any) => d.discountPercent))}% off`)}</Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deals.slice(0, 3).map((st: any) => (
                <Link key={st.id} href={`/store/${st.id}`} className="group flex items-center gap-4 rounded-2xl bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition">
                  <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-royal-800">
                    {st.bannerUrl ? (
                      <img src={st.bannerUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-2xl font-black text-gold-400">{st.nameAr?.[0]}</div>
                    )}
                    <span className="absolute bottom-1 end-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">-{st.discountPercent}%</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-extrabold text-white">{st.nameAr}</h3>
                    <p className="truncate text-[11px] text-white/50">{st.description || catName(st.categoryId) || st.nameEn}</p>
                    <span className="mt-2 inline-block rounded-lg bg-gold-500 px-3 py-1 text-[11px] font-black text-royal-950 group-hover:bg-gold-400">
                      {s("اطلب من هنا", "Order here")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ---------- Featured (pinned) ---------- */}
        {pinned.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-black text-royal-900 md:text-xl">{s("مختارات لقمة المميزة", "Luqma featured picks")}</h2>
              <span className="h-px flex-1 bg-royal-150" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {pinned.map((st: any) => (
                <StoreCard key={st.id} store={st} featured />
              ))}
            </div>
          </section>
        )}

        {/* ---------- Rotating grid ---------- */}
        <section id="stores" className="mt-10 scroll-mt-28">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-black text-royal-900 md:text-xl">{s("مطاعم قريبة منك", "Restaurants near you")}</h2>
              <span className="rounded-full bg-royal-100 px-2.5 py-1 text-[10px] font-black text-royal-600">{data?.all || 0}</span>
            </div>
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-royal-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {s("يتجدد العرض تلقائياً كل 5 دقائق", "Selection auto-refreshes every 5 minutes")}
            </span>
          </div>
          {rotating.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-royal-200 py-14 text-center text-sm font-bold text-royal-400">
              {s("لا توجد مطاعم مطابقة", "No matching restaurants")}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {rotating.map((st: any) => (
                <StoreCard key={st.id} store={st} />
              ))}
            </div>
          )}
        </section>

        {/* ---------- Why Luqma strip ---------- */}
        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { t: s("مطاعم موثقة", "Verified restaurants"), d: s("جميع الشركاء يخضعون لمراجعة إدارية صارمة", "Every partner passes strict admin review") },
            { t: s("تتبع مباشر", "Live tracking"), d: s("تابع طلبك لحظة بلحظة حتى يصل بابك", "Follow your order step by step") },
            { t: s("مكافآت بونس", "Bonus rewards"), d: s("ارصد بونسك واستخدمه في دفع طلباتك", "Earn bonus and pay part of your orders with it") },
          ].map((f, i) => (
            <div key={i} className="rounded-2xl border border-royal-100 bg-white p-5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-100 text-gold-700 font-black">{i + 1}</span>
              <h3 className="mt-3 text-sm font-extrabold text-royal-900">{f.t}</h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{f.d}</p>
            </div>
          ))}
        </section>
      </main>

      <Footer />
      <WhatsAppFab />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-royal-950"><Spinner light /></div>}>
      <HomeInner />
    </Suspense>
  );
}
