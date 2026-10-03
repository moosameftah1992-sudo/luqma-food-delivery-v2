"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header, Footer, WhatsAppFab, Btn, Field, inputCls, Modal, Badge, StoreStatusBadge, Spinner, Empty, StatusBadge } from "@/components/ui";
import { useL, fmtNum, fmtDate } from "@/lib/i18n";

type CartLine = { product: any; qty: number; options: { name: string; choice: string; price: number }[]; unit: number };

export default function StoreMenuPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { s, lang } = useL();
  const [me, setMe] = useState<any>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [data, setData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [locations, setLocations] = useState<any>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [catFilter, setCatFilter] = useState("");
  const [itemModal, setItemModal] = useState<any>(null);
  const [orderDone, setOrderDone] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // checkout state
  const [addrSel, setAddrSel] = useState<string>("default"); // address id or "temp"
  const [tempAddr, setTempAddr] = useState({ label: "", line: "", governorateId: "", areaId: "" });
  const [pay, setPay] = useState("cod");
  const [useBonus, setUseBonus] = useState(true);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((j) => {
      if (!j.loggedIn) {
        setAuthed(false);
        router.replace(`/auth/login?next=/store/${id}`);
      } else {
        setAuthed(true);
        fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "me" }) })
          .then((r) => r.json()).then((m) => setMe(m));
      }
    });
    fetch(`/api/stores/${id}`).then((r) => r.json()).then(setData);
    fetch("/api/cms").then((r) => r.json()).then((j) => setSettings(j.settings));
    fetch("/api/locations").then((r) => r.json()).then(setLocations).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const store = data?.store;
  const products = (data?.products || []).filter((p: any) => !catFilter || String(p.categoryId) === catFilter);

  const total = useMemo(() => {
    const sub = cart.reduce((a, l) => a + l.unit * l.qty, 0);
    const disc = sub * ((store?.discountPercent || 0) / 100);
    const fee = Number(store?.deliveryFee || 0);
    const bonus = useBonus && me ? Math.min(Number(me.user?.bonusBalance || 0), sub - disc) : 0;
    return { sub, disc, fee, bonus, total: Math.max(0, sub - disc + fee - bonus) };
  }, [cart, store, me, useBonus]);

  const addLine = (line: CartLine) => {
    setCart((c) => {
      const key = (l: CartLine) => l.product.id + "|" + l.options.map((o) => o.choice).join(",");
      const ex = c.find((l) => key(l) === key(line));
      if (ex) return c.map((l) => (key(l) === key(line) ? { ...l, qty: l.qty + line.qty } : l));
      return [...c, line];
    });
    setItemModal(null);
  };

  const placeOrder = async () => {
    if (addrSel === "temp" && !tempAddr.line.trim()) {
      setErr(s("أدخل تفاصيل العنوان المؤقت", "Enter the temporary address details"));
      return;
    }
    let address: Record<string, string>;
    if (addrSel === "temp") {
      const gov = (locations?.governorates || []).find((g: any) => String(g.id) === tempAddr.governorateId);
      const area = (locations?.areas || []).find((a: any) => String(a.id) === tempAddr.areaId);
      address = { label: tempAddr.label || s("عنوان مؤقت", "Temp address"), line: tempAddr.line, governorate: gov?.nameAr || "", area: area?.nameAr || "" };
    } else {
      const a = (me?.addresses || []).find((x: any) => String(x.id) === addrSel) || (me?.addresses || [])[0];
      if (!a) {
        setErr(s("أضف عنواناً أولاً", "Add an address first"));
        return;
      }
      const gov = (locations?.governorates || []).find((g: any) => String(g.id) === String(a.governorateId));
      const area = (locations?.areas || []).find((x: any) => String(x.id) === String(a.areaId));
      address = { label: a.label, line: a.line, governorate: gov?.nameAr || "", area: area?.nameAr || "" };
    }
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: Number(id),
          address,
          paymentMethod: pay,
          bonusUsed: useBonus ? total.bonus : 0,
          items: cart.map((l) => ({ productId: l.product.id, qty: l.qty, options: l.options })),
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Failed");
      setOrderDone(j.order);
      setCart([]);
      setCheckout(false);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (authed === null) {
    return <div className="grid min-h-screen place-items-center bg-royal-950"><Spinner light /></div>;
  }
  if (authed === false) {
    return (
      <div className="grid min-h-screen place-items-center bg-royal-950 text-white">
        <div className="text-center">
          <h1 className="text-lg font-black">{s("سجّل دخولك لمتابعة الطلب", "Sign in to continue ordering")}</h1>
          <Btn className="mt-4" onClick={() => router.push(`/auth/login?next=/store/${id}`)}>{s("تسجيل الدخول", "Log in")}</Btn>
        </div>
      </div>
    );
  }

  const addresses = me?.addresses || [];
  const payments: Record<string, boolean> = settings?.payments || {};

  return (
    <div className="min-h-screen">
      <Header user={me?.user ? { name: me.user.name, bonus: me.user.bonusBalance } : null} />

      {/* success screen */}
      {orderDone ? (
        <main className="mx-auto max-w-2xl px-4 py-14">
          <div className="rounded-3xl bg-white p-8 text-center shadow-xl fade-up">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
            <h1 className="mt-5 text-2xl font-black text-royal-950">{s("تم استلام طلبك!", "Order placed!")}</h1>
            <p className="mt-2 text-sm text-gray-500">{s("رقم الطلب", "Order no.")} <span className="font-black text-royal-800" dir="ltr">{orderDone.orderNo}</span></p>
            <div className="mx-auto my-5 w-fit"><StatusBadge status={orderDone.status} /></div>
            <div className="mx-auto max-w-sm rounded-2xl bg-royal-50 p-4 text-start text-xs font-bold text-royal-700">
              {s("يمكنك إلغاء الطلب خلال 5 دقائق فقط من تقديمه. بعد ذلك تواصل مع الدعم عبر واتساب.", "You can cancel within 5 minutes of placing the order. After that, contact WhatsApp support.")}
            </div>
            <div className="mt-6 flex justify-center gap-2">
              <Btn onClick={() => router.push("/account")}>{s("متابعة طلباتي", "Track my orders")}</Btn>
              <Btn variant="outline" onClick={() => setOrderDone(null)}>{s("متابعة التصفح", "Keep browsing")}</Btn>
            </div>
          </div>
        </main>
      ) : (
        <>
          {/* store hero */}
          {store && (
            <div className="relative h-52 md:h-64 overflow-hidden">
              {store.bannerUrl ? (
                <img src={store.bannerUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-royal-800 to-royal-950" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-royal-950/85 via-royal-950/25 to-transparent" />
              <div className="absolute bottom-0 start-0 w-full">
                <div className="mx-auto flex max-w-7xl items-end gap-4 px-4 pb-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-gold-400 bg-royal-900 text-2xl font-black text-gold-400 shadow-lg">
                    {store.logoUrl ? <img src={store.logoUrl} alt="" className="h-full w-full object-cover" /> : store.nameAr?.[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-xl font-black text-white md:text-2xl">{store.nameAr}</h1>
                    <p className="text-xs text-white/60" dir="ltr" style={{ textAlign: "start" }}>{store.nameEn} · {store.area || store.governorate || ""}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StoreStatusBadge status={store.status} />
                    {store.discountPercent > 0 && <Badge tone="gold">{s(`عرض خاص: خصم ${store.discountPercent}%`, `Special offer: ${store.discountPercent}% off`)}</Badge>}
                  </div>
                </div>
              </div>
            </div>
          )}

          <main className="mx-auto max-w-7xl px-4">
            {/* hours + info strip */}
            {store && (
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-royal-100 bg-white px-4 py-3 text-[11px] font-bold text-royal-700">
                <span>{s("التوصيل", "Delivery")}: {fmtNum(store.deliveryFee)}</span>
                <span>{s("الحد الأدنى", "Min order")}: {fmtNum(store.minOrder)}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {s("أوقات العمل", "Hours")}:
                  {(store.workingHours || []).filter((h: any) => h.enabled).map((h: any, i: number) => (
                    <Badge key={i} tone="purple"><span dir="ltr">{h.from} – {h.to}</span></Badge>
                  ))}
                </span>
              </div>
            )}

            {/* category chips */}
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => setCatFilter("")} className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-black ${!catFilter ? "bg-royal-900 text-white" : "bg-white border border-royal-150 text-royal-700"}`}>
                {s("الكل", "All")}
              </button>
              {(data?.categories || []).map((c: any) => (
                <button key={c.id} onClick={() => setCatFilter(String(c.id))} className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-black ${catFilter === String(c.id) ? "bg-royal-900 text-white" : "bg-white border border-royal-150 text-royal-700"}`}>
                  {c.nameAr}
                </button>
              ))}
            </div>

            {/* products */}
            <div className="mt-5 grid gap-4 pb-28 sm:grid-cols-2 lg:grid-cols-3">
              {products.length === 0 && <div className="col-span-full"><Empty text={s("لا توجد أصناف في هذا القسم", "No items in this category")} /></div>}
              {products.map((p: any) => (
                <div key={p.id} className={`group overflow-hidden rounded-2xl border border-royal-100 bg-white shadow-sm transition ${p.available ? "hover:shadow-lg" : "opacity-60"}`}>
                  <div className="relative h-40 overflow-hidden bg-royal-100">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt={p.nameAr} className="h-full w-full object-cover group-hover:scale-105 transition duration-500" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-royal-200 to-royal-300 text-3xl font-black text-royal-500">{p.nameAr?.[0]}</div>
                    )}
                    {!p.available && (
                      <div className="absolute inset-0 grid place-items-center bg-royal-950/50">
                        <span className="rounded-full bg-white px-4 py-1 text-xs font-black text-royal-900">{s("غير متوفر حالياً", "Out of stock")}</span>
                      </div>
                    )}
                    {p.discountPercent > 0 && <span className="absolute top-2 start-2 rounded-lg bg-red-600 px-2 py-1 text-[10px] font-black text-white">-{p.discountPercent}%</span>}
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-extrabold text-royal-950">{p.nameAr}</h3>
                    <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-relaxed text-gray-500">{p.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-black text-royal-900">{fmtNum(p.price)}</span>
                        {p.oldPrice && <span className="text-[11px] font-bold text-gray-400 line-through">{fmtNum(p.oldPrice)}</span>}
                      </div>
                      <Btn disabled={!p.available} onClick={() => setItemModal(p)} className="px-3.5 py-2 text-xs">
                        {s("أضف +", "Add +")}
                      </Btn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </>
      )}

      {/* cart bar */}
      {cart.length > 0 && !orderDone && (
        <div className="no-print fixed bottom-0 start-0 end-0 z-40 border-t border-royal-100 bg-white/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-1">
            <button onClick={() => setCartOpen(true)} className="text-start">
              <span className="block text-xs font-bold text-royal-500">{cart.reduce((a, l) => a + l.qty, 0)} {s("صنف في السلة", "items in cart")}</span>
              <span className="block text-base font-black text-royal-950">{fmtNum(total.sub - total.disc)}</span>
            </button>
            <Btn onClick={() => { setCartOpen(true); setCheckout(true); setErr(""); }} className="px-8">
              {s("إتمام الطلب", "Checkout")} {fmtNum(total.total)}
            </Btn>
          </div>
        </div>
      )}

      {/* item options modal */}
      {itemModal && (
        <ItemOptionsModal
          product={itemModal}
          onClose={() => setItemModal(null)}
          onAdd={addLine}
        />
      )}

      {/* cart + checkout drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-royal-950/60" onClick={() => !checkout && setCartOpen(false)} />
          <div className="absolute inset-y-0 end-0 w-full max-w-md overflow-y-auto bg-white shadow-2xl fade-up flex flex-col">
            <div className="flex items-center justify-between border-b border-royal-100 px-5 py-4">
              <h3 className="text-base font-black text-royal-950">{checkout ? s("إتمام الطلب", "Checkout") : s("سلة الطلب", "Your cart")}</h3>
              <button onClick={() => (checkout ? setCheckout(false) : setCartOpen(false))} className="grid h-8 w-8 place-items-center rounded-full bg-royal-50 text-royal-700">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {err && <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-600">{err}</div>}
              {cart.length === 0 ? (
                <Empty text={s("السلة فارغة", "Cart is empty")} />
              ) : (
                cart.map((l, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl border border-royal-100 p-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-royal-100">
                      {l.product.images?.[0] ? <img src={l.product.images[0]} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-extrabold text-royal-950">{l.product.nameAr}</p>
                      {l.options.length > 0 && (
                        <p className="mt-0.5 text-[10px] text-gray-500">{l.options.map((o) => o.choice).join("، ")}</p>
                      )}
                      <p className="mt-0.5 text-[11px] font-black text-royal-700">{fmtNum(l.unit * l.qty)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button className="grid h-7 w-7 place-items-center rounded-lg bg-royal-50 font-black text-royal-700" onClick={() => setCart((c) => c.map((x, j) => (j === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}>−</button>
                      <span className="w-5 text-center text-sm font-black">{l.qty}</span>
                      <button className="grid h-7 w-7 place-items-center rounded-lg bg-royal-50 font-black text-royal-700" onClick={() => setCart((c) => c.map((x, j) => (j === i ? { ...x, qty: x.qty + 1 } : x)))}>+</button>
                      <button className="ms-1 grid h-7 w-7 place-items-center rounded-lg text-red-400 hover:bg-red-50" onClick={() => setCart((c) => c.filter((_, j) => j !== i))}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  </div>
                ))
              )}

              {checkout && cart.length > 0 && (
                <div className="space-y-4 pt-2">
                  {/* address */}
                  <div>
                    <h4 className="mb-2 text-xs font-black text-royal-900">{s("1 — تأكيد عنوان التوصيل (إلزامي)", "1 — Confirm delivery address (required)")}</h4>
                    <div className="space-y-2">
                      {addresses.map((a: any) => (
                        <label key={a.id} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition ${addrSel === String(a.id) ? "border-royal-500 bg-royal-50" : "border-royal-150 hover:border-royal-300"}`}>
                          <input type="radio" checked={addrSel === String(a.id)} onChange={() => setAddrSel(String(a.id))} className="mt-0.5 accent-royal-700" />
                          <span>
                            <span className="font-black text-royal-950">{a.label} {a.isDefault && <Badge tone="gold">{s("افتراضي", "Default")}</Badge>}</span>
                            <span className="mt-0.5 block text-gray-500">{a.line}</span>
                          </span>
                        </label>
                      ))}
                      <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition ${addrSel === "temp" ? "border-gold-500 bg-gold-100/40" : "border-royal-150 hover:border-royal-300"}`}>
                        <input type="radio" checked={addrSel === "temp"} onChange={() => setAddrSel("temp")} className="mt-0.5 accent-royal-700" />
                        <span className="font-black text-royal-950">{s("استخدام عنوان مؤقت لهذا الطلب فقط", "Use a temporary address for this order only")}</span>
                      </label>
                    </div>
                    {addrSel === "temp" && (
                      <div className="mt-3 space-y-2 rounded-2xl bg-royal-50/60 p-3">
                        <div className="grid grid-cols-2 gap-2">
                          <input className={inputCls} placeholder={s("المحافظة", "Governorate")} list="govs" value={tempAddr.governorateId} onChange={(e) => setTempAddr((t) => ({ ...t, governorateId: e.target.value }))} />
                          <input className={inputCls} placeholder={s("المنطقة", "Area")} list="areas" value={tempAddr.areaId} onChange={(e) => setTempAddr((t) => ({ ...t, areaId: e.target.value }))} />
                        </div>
                        <datalist id="govs">{(locations?.governorates || []).map((g: any) => <option key={g.id} value={g.nameAr}>{g.nameAr}</option>)}</datalist>
                        <input className={inputCls} placeholder={s("تفاصيل العنوان: الشارع، البناية…", "Address details: street, building…")} value={tempAddr.line} onChange={(e) => setTempAddr((t) => ({ ...t, line: e.target.value }))} />
                      </div>
                    )}
                  </div>

                  {/* payment */}
                  <div>
                    <h4 className="mb-2 text-xs font-black text-royal-900">{s("2 — طريقة الدفع", "2 — Payment method")}</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["card", s("بطاقة", "Card")],
                        ["benefi", "BenefitPay"],
                        ["cod", s("نقداً", "COD")],
                      ].map(([k, label]) => {
                        const enabled = k === "cod" ? payments.cod : k === "card" ? payments.card : payments.benefi;
                        return (
                          <button key={k} disabled={!enabled} onClick={() => setPay(k)} className={`rounded-xl border p-2.5 text-xs font-black transition ${pay === k ? "border-royal-700 bg-royal-900 text-white" : "border-royal-150 text-royal-800"} ${!enabled ? "opacity-40 cursor-not-allowed line-through" : ""}`}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* bonus */}
                  <div>
                    <h4 className="mb-2 text-xs font-black text-royal-900">{s("3 — رصيد البونس", "3 — Bonus balance")}</h4>
                    <label className={`flex items-center justify-between rounded-xl border p-3 text-xs font-bold transition ${useBonus ? "border-gold-500 bg-gold-100/40" : "border-royal-150"}`}>
                      <span className="text-royal-800">{s("استخدام البونس في الدفع", "Apply bonus to payment")}</span>
                      <span className="font-black text-gold-700">{fmtNum(me?.user?.bonusBalance)} <input type="checkbox" checked={useBonus} onChange={(e) => setUseBonus(e.target.checked)} className="ms-2 accent-gold-600" /></span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-royal-100 bg-royal-50/50 p-4 space-y-1.5 text-xs font-bold text-royal-800">
                <div className="flex justify-between"><span>{s("المجموع الفرعي", "Subtotal")}</span><span>{fmtNum(total.sub)}</span></div>
                {total.disc > 0 && <div className="flex justify-between text-emerald-600"><span>{s(`خصم المطعم (${store?.discountPercent}%)`, `Store discount (${store?.discountPercent}%)`)}</span><span>−{fmtNum(total.disc)}</span></div>}
                <div className="flex justify-between"><span>{s("رسوم التوصيل", "Delivery fee")}</span><span>{fmtNum(total.fee)}</span></div>
                {total.bonus > 0 && <div className="flex justify-between text-gold-700"><span>{s("مستقطع من البونس", "Deducted from bonus")}</span><span>−{fmtNum(total.bonus)}</span></div>}
                <div className="flex justify-between border-t border-royal-150 pt-2 text-base font-black text-royal-950"><span>{s("الإجمالي", "Total")}</span><span>{fmtNum(total.total)}</span></div>
                <Btn className="mt-3 w-full" disabled={busy} onClick={checkout ? placeOrder : () => setCheckout(true)}>
                  {busy ? <Spinner /> : checkout ? s("تأكيد الطلب ✓", "Place order ✓") : s("المتابعة للدفع", "Continue to payment")}
                </Btn>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
      <WhatsAppFab />
    </div>
  );
}

function ItemOptionsModal({ product, onClose, onAdd }: { product: any; onClose: () => void; onAdd: (l: CartLine) => void }) {
  const { s } = useL();
  const [qty, setQty] = useState(1);
  const [sel, setSel] = useState<Record<string, string>>({});
  const options: any[] = product.options || [];
  const base = Number(product.price || 0);
  const unit = base + options.reduce((sum, g) => sum + (Number(g.choices.find((c: any) => c.name === sel[g.name])?.price) || 0), 0);

  return (
    <Modal open onClose={onClose} title={product.nameAr}>
      <div className="space-y-4">
        {product.images?.[0] && <img src={product.images[0]} alt="" className="h-40 w-full rounded-2xl object-cover" />}
        {options.map((g) => (
          <div key={g.name}>
            <p className="mb-1.5 text-xs font-black text-royal-900">{g.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.choices.map((c: any) => (
                <button
                  key={c.name}
                  onClick={() => setSel((p) => ({ ...p, [g.name]: c.name }))}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${sel[g.name] === c.name ? "border-royal-700 bg-royal-900 text-white" : "border-royal-150 text-royal-800 hover:border-royal-400"}`}
                >
                  {c.name} {c.price > 0 && <span className="text-gold-600">+{fmtNum(c.price)}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="grid h-9 w-9 place-items-center rounded-xl bg-royal-50 text-lg font-black text-royal-800" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <span className="w-8 text-center text-base font-black">{qty}</span>
            <button className="grid h-9 w-9 place-items-center rounded-xl bg-royal-50 text-lg font-black text-royal-800" onClick={() => setQty((q) => q + 1)}>+</button>
          </div>
          <Btn onClick={() => onAdd({ product, qty, options: options.filter((g) => sel[g.name]).map((g) => ({ name: g.name, choice: sel[g.name], price: Number(g.choices.find((c: any) => c.name === sel[g.name])?.price) || 0 })), unit })}>
            {s("أضف للسلة", "Add to cart")} · {fmtNum(unit * qty)}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
