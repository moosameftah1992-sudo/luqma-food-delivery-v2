"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomerChrome, StatusPill, type Banner, type GovOpt } from "@/components/customer-home";
import { Btn, Card, Modal, Price } from "@/components/ui";
import { writeCart, readCart, cartTotal, type Cart, type CartLine } from "@/lib/cart";
import { cn, fmtFils, fmtDate } from "@/lib/util";
import type { Brand } from "@/lib/brand";
import { useLocale } from "@/components/locale-provider";
import { bahrainClock, WEEKDAYS_AR, WEEKDAYS_EN, type WorkingPeriod } from "@/lib/working-hours";

type Size = { id: number; nameAr: string; priceFils: number };
type Addon = { id: number; nameAr: string; priceFils: number };
type Item = {
  id: number;
  categoryId: number | null;
  nameAr: string;
  description: string;
  image: string;
  priceFils: number;
  discountPct: number;
  available: boolean;
  sizes: Size[];
  addons: Addon[];
};
type Category = { id: number; nameAr: string; sortOrder: number };
type Review = { id: number; rating: number; comment: string; createdAt: string; name: string | null };
type Store = {
  id: number;
  nameAr: string;
  nameEn: string | null;
  cuisine: string;
  description: string;
  image: string;
  status: string;
  workingHours: WorkingPeriod[];
  minOrderFils: number;
  address: string;
  rating: number | null;
  ratingCount: number;
};

export function RestaurantView({
  brand,
  logoOverride,
  userName,
  gov,
  store,
  categories,
  items,
  reviews,
}: {
  brand: Brand;
  logoOverride?: string;
  userName?: string | null;
  gov: GovOpt[];
  store: Store;
  categories: Category[];
  items: Item[];
  reviews: Review[];
}) {
  const [cart, setCart] = useState<Cart | null>(null);
  const { locale, tr } = useLocale();
  const today = bahrainClock().day;
  const periodLabel = (period: WorkingPeriod) =>
    period.from === period.to ? tr("٢٤ ساعة", "24 hours") : `${period.from} – ${period.to}`;
  const todayPeriods = store.workingHours.filter((period) => period.day === today);
  const [active, setActive] = useState<Item | null>(null);
  const [sizeId, setSizeId] = useState<number | null>(null);
  const [addons, setAddons] = useState<number[]>([]);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => setCart(readCart()), []);

  const openItem = (it: Item) => {
    setActive(it);
    setSizeId(it.sizes[0]?.id ?? null);
    setAddons([]);
    setQty(1);
    setNote("");
  };

  const unitPrice = useMemo(() => {
    if (!active) return 0;
    const size = active.sizes.find((s) => s.id === sizeId);
    return size ? size.priceFils : active.priceFils;
  }, [active, sizeId]);

  const addonTotal = useMemo(() => {
    if (!active) return 0;
    return active.addons
      .filter((a) => addons.includes(a.id))
      .reduce((s, a) => s + a.priceFils, 0);
  }, [active, addons]);

  const lineTotal = (unitPrice + addonTotal) * qty;

  const addToCart = () => {
    if (!active) return;
    const chosen = active.addons.filter((a) => addons.includes(a.id));
    const size = active.sizes.find((s) => s.id === sizeId) ?? null;
    const base: Cart = cart && cart.storeId === store.id
      ? cart
      : {
          storeId: store.id,
          storeName: store.nameAr,
          deliveryFeeFils: defaultFee(gov),
          items: [],
        };
    const line: CartLine = {
      itemId: active.id,
      name: active.nameAr,
      sizeName: size?.nameAr ?? null,
      sizeId: size?.id ?? null,
      unitPrice,
      qty,
      addons: chosen.map((a) => ({ name: a.nameAr, price: a.priceFils })),
      addonIds: chosen.map((a) => a.id),
      lineTotal,
    };
    const next = { ...base, items: [...base.items, line] };
    writeCart(next);
    setCart(next);
    setActive(null);
    setCartOpen(true);
  };

  const grouped = categories.map((c) => ({
    cat: c,
    items: items.filter((i) => i.categoryId === c.id),
  }));
  const others = items.filter((i) => !categories.some((c) => c.id === i.categoryId));

  return (
    <CustomerChrome brand={brand} logoOverride={logoOverride} userName={userName}>
      <section className="relative isolate overflow-hidden bg-[#1B0733]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={store.image} alt={store.nameAr} className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-l from-[#1B0733]/30 to-[#1B0733]" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={store.status} />
            <span className="text-sm font-bold text-[#FDBA21]">
              ★ {store.rating ? store.rating.toFixed(1) : "جديد"}{" "}
              <span className="font-normal text-white/60">({store.ratingCount} تقييم)</span>
            </span>
          </div>
          <h1 className="mt-3 font-display text-5xl font-extrabold text-white">{store.nameAr}</h1>
          <p className="mt-2 max-w-2xl text-white/70">
            {store.description} — {store.cuisine}
          </p>
          <p className="mt-3 text-sm text-white/55">{store.address}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-white/70">
            <span className="rounded-full border border-white/20 px-3 py-1.5">
              أقل طلب {fmtFils(store.minOrderFils)}
            </span>
            <span className="rounded-full border border-white/20 px-3 py-1.5">
              رسوم التوصيل حسب المنطقة
            </span>
            <span className="rounded-full border border-[#FDBA21]/50 bg-[#FDBA21]/15 px-3 py-1.5 text-[#FDBA21]">
              وسائل الدفع حسب التوفر عند إتمام الطلب
            </span>
          </div>
          {store.workingHours.length > 0 && (
            <details className="mt-5 max-w-xl rounded-xl border border-white/20 bg-[#1B0733]/65 px-4 py-3 text-sm text-white/85">
              <summary className="cursor-pointer font-bold text-[#FFD269]">
                {tr("أوقات العمل اليوم", "Today's opening hours")}: {todayPeriods.length
                  ? todayPeriods.map(periodLabel).join(" · ")
                  : tr("لا فترات محددة لليوم", "No periods scheduled today")}
              </summary>
              <div className="mt-3 space-y-1.5 border-t border-white/15 pt-3">
                {Array.from({ length: 7 }, (_, day) => {
                  const periods = store.workingHours.filter((period) => period.day === day);
                  return (
                    <div key={day} className="flex items-center justify-between gap-3">
                      <span className="font-bold">{locale === "en" ? WEEKDAYS_EN[day] : WEEKDAYS_AR[day]}</span>
                      <span className="text-white/65" dir="ltr">{periods.length ? periods.map(periodLabel).join(" · ") : tr("مغلق", "Closed")}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-white/50">{tr("جميع الأوقات بتوقيت البحرين", "All times are in Bahrain time")}</p>
            </details>
          )}
        </div>
        <div className="rule-gold h-1 w-full" />
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {grouped.map(({ cat, items }) =>
          items.length ? (
            <section key={cat.id} id={`cat-${cat.id}`} className="mb-10">
              <h2 className="border-b-2 border-[#2A0A4A] pb-2 font-display text-2xl font-extrabold text-[#2A0A4A]">
                {cat.nameAr}
              </h2>
              <ul>
                {items.map((it) => (
                  <li key={it.id}>
                    <button
                      onClick={() => it.available && store.status === "open" && openItem(it)}
                      disabled={!it.available || store.status !== "open"}
                      className="group flex w-full items-center gap-4 border-b border-[#2A0A4A]/10 py-4 text-right transition hover:bg-white disabled:opacity-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-lg font-extrabold text-[#2A0A4A]">
                            {it.nameAr}
                          </h3>
                          {it.discountPct > 0 && (
                            <span className="rounded-full bg-[#FF7A00] px-2 py-0.5 text-[10px] font-extrabold text-white">
                              خصم {it.discountPct}%
                            </span>
                          )}
                          {!it.available && (
                            <span className="rounded-full bg-[#2A0A4A]/10 px-2 py-0.5 text-[10px] font-bold text-[#6B5E7A]">
                              غير متوفر
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-[#6B5E7A]">{it.description}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <Price
                            fils={Math.round(it.priceFils * (1 - it.discountPct / 100))}
                            className="text-[#B4520A]"
                          />
                          {it.sizes.length > 0 && (
                            <span className="text-xs text-[#6B5E7A]">
                              {it.sizes.length} أحجام
                            </span>
                          )}
                        </div>
                      </div>
                      {it.image && (
                        <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-[#2A0A4A]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={it.image} alt={it.nameAr} className="h-full w-full object-cover" />
                        </div>
                      )}
                      <span className="hidden shrink-0 rounded-xl bg-[#2A0A4A] px-4 py-2 text-sm font-extrabold text-white transition group-hover:bg-[#FF7A00] group-hover:text-[#2A0A4A] sm:block">
                        أضف
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}

        {!!others.length && (
          <section className="mb-10">
            <h2 className="border-b-2 border-[#2A0A4A] pb-2 font-display text-2xl font-extrabold text-[#2A0A4A]">
              أصناف أخرى
            </h2>
            <ul>
              {others.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-4 border-b border-[#2A0A4A]/10 py-4">
                  <div>
                    <h3 className="font-display text-lg font-extrabold text-[#2A0A4A]">{it.nameAr}</h3>
                    <p className="text-sm text-[#6B5E7A]">{it.description}</p>
                  </div>
                  <Price fils={it.priceFils} className="text-[#B4520A]" />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="border-b-2 border-[#2A0A4A] pb-2 font-display text-2xl font-extrabold text-[#2A0A4A]">
            آراء العملاء ({reviews.length})
          </h2>
          {reviews.length === 0 && (
            <p className="py-6 text-sm text-[#6B5E7A]">لا توجد تقييمات بعد — كن أول من يقيّم!</p>
          )}
          <ul className="divide-y divide-[#2A0A4A]/8">
            {reviews.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#2A0A4A] font-display text-sm font-extrabold text-[#FDBA21]">
                    {r.name?.[0] ?? "ع"}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#2A0A4A]">{r.name ?? "عميل لقمة"}</p>
                    <p className="text-xs text-[#6B5E7A]">
                      {"★".repeat(r.rating)}
                      {"☆".repeat(5 - r.rating)} · {fmtDate(r.createdAt)}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#2B2433]/85">{r.comment}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* item composer */}
      <Modal open={!!active} onClose={() => setActive(null)} title={active?.nameAr ?? ""}>
        {active && (
          <div className="space-y-5">
            <p className="text-sm text-[#6B5E7A]">{active.description}</p>

            {active.sizes.length > 0 && (
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#6B5E7A]">
                  اختر الحجم
                </p>
                <div className="mt-2 space-y-2">
                  {active.sizes.map((s) => (
                    <label
                      key={s.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold transition",
                        sizeId === s.id
                          ? "border-[#FDBA21] bg-[#FDBA21]/12"
                          : "border-[#2A0A4A]/12 hover:border-[#2A0A4A]/35",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={sizeId === s.id}
                          onChange={() => setSizeId(s.id)}
                          className="accent-[#FF7A00]"
                        />
                        {s.nameAr}
                      </span>
                      <Price fils={s.priceFils} />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {active.addons.length > 0 && (
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#6B5E7A]">
                  إضافات اختيارية
                </p>
                <div className="mt-2 space-y-2">
                  {active.addons.map((a) => (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-[#2A0A4A]/12 px-4 py-3 text-sm font-bold transition hover:border-[#2A0A4A]/35"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={addons.includes(a.id)}
                          onChange={() =>
                            setAddons((prev) =>
                              prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id],
                            )
                          }
                          className="accent-[#FF7A00]"
                        />
                        {a.nameAr}
                      </span>
                      <Price fils={a.priceFils} />
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#6B5E7A]">
                ملاحظة للمطبخ
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="مثال: بدون بصل، حار زيادة…"
                className="mt-2 w-full rounded-xl border border-[#2A0A4A]/15 px-3 py-2 text-sm outline-none focus:border-[#FDBA21]"
              />
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-[#2A0A4A]/10 pt-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-[#2A0A4A]/8 font-bold text-[#2A0A4A]"
                >
                  −
                </button>
                <span className="w-8 text-center font-display text-lg font-extrabold tabular-nums">
                  {qty}
                </span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-[#2A0A4A]/8 font-bold text-[#2A0A4A]"
                >
                  +
                </button>
              </div>
              <Btn onClick={addToCart} className="px-6">
                أضف للسلة — <Price fils={lineTotal} />
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* cart bar */}
      {cart && cart.items.length > 0 && (
        <div className="fixed bottom-10 left-4 right-4 z-40 sm:left-auto sm:w-96">
          <button
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between gap-4 rounded-2xl bg-[#2A0A4A] px-5 py-4 text-white shadow-[0_20px_50px_-25px_rgba(27,7,51,0.9)]"
          >
            <span className="font-display font-extrabold">
              {cart.items.length} أصناف — {cart.storeName}
            </span>
            <span className="rounded-xl bg-[#FDBA21] px-3 py-1.5 font-extrabold text-[#2A0A4A] tabular-nums">
              {fmtFils(cartTotal(cart))}
            </span>
          </button>
        </div>
      )}

      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title="سلة الطلب">
        {cart && cart.items.length ? (
          <div className="space-y-4">
            <ul className="divide-y divide-[#2A0A4A]/8">
              {cart.items.map((l, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-bold text-[#2A0A4A]">
                      {l.qty}× {l.name}
                      {l.sizeName ? ` · ${l.sizeName}` : ""}
                    </p>
                    {l.addons.length > 0 && (
                      <p className="text-xs text-[#6B5E7A]">
                        + {l.addons.map((a) => a.name).join("، ")}
                      </p>
                    )}
                    <button
                      onClick={() => {
                        const next = { ...cart, items: cart.items.filter((_, idx) => idx !== i) };
                        writeCart(next.items.length ? next : null);
                        setCart(next.items.length ? next : null);
                      }}
                      className="mt-1 text-xs font-bold text-rose-600"
                    >
                      حذف
                    </button>
                  </div>
                  <Price fils={l.lineTotal} />
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-[#2A0A4A]/10 pt-4 font-display text-lg font-extrabold text-[#2A0A4A]">
              <span>المجموع</span>
              <Price fils={cartTotal(cart)} />
            </div>
            <a href="/checkout" className="block">
              <Btn className="w-full py-3 text-base">إتمام الطلب والدفع</Btn>
            </a>
          </div>
        ) : (
          <p className="text-sm text-[#6B5E7A]">السلة فارغة</p>
        )}
      </Modal>
    </CustomerChrome>
  );
}

function defaultFee(gov: GovOpt[]) {
  return gov[0]?.areas[0]?.deliveryFeeFils ?? 1500;
}
