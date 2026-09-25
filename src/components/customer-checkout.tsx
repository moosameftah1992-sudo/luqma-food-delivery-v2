"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Banknote, CheckCircle2, CreditCard, Gift, LockKeyhole, MapPin, ReceiptText, ShieldCheck, Smartphone } from "lucide-react";
import { CustomerChrome, type GovOpt } from "@/components/customer-home";
import { useLocale } from "@/components/locale-provider";
import { Btn, Card, Field, Price, inputCls } from "@/components/ui";
import { useToast } from "@/components/alert";
import { readCart, writeCart, cartTotal, type Cart } from "@/lib/cart";
import { fmtFils } from "@/lib/util";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-types";
import type { Brand } from "@/lib/brand";

type PaymentConfig = {
  ready: boolean;
  bonusBalanceFils: number;
  methods: Record<PaymentMethod, { enabled: boolean; configured: boolean; available: boolean; ar: string; en: string }>;
};
type Completed = { code: string; totalFils: number; bonusUsedFils: number; amountDueFils: number; cash: boolean; paid: boolean };
const OPTIONS = {
  benefitpay: { ar: "بنفت باي", en: "BenefitPay", descAr: "ادفع عبر تطبيق بنفت باي", descEn: "Pay with the BenefitPay app", icon: Smartphone },
  card: { ar: "بطاقة ائتمانية / خصم", en: "Debit or credit card", descAr: "فيزا أو ماستركارد عبر بوابة آمنة", descEn: "Visa or Mastercard on secure checkout", icon: CreditCard },
  cash: { ar: "نقداً عند الاستلام", en: "Cash on delivery", descAr: "ادفع للمندوب عند استلام طلبك", descEn: "Pay the courier when your order arrives", icon: Banknote },
} as const;

export function CheckoutView({ brand, logoOverride, userName, gov, defaultAddress }: {
  brand: Brand; logoOverride?: string; userName?: string | null; gov: GovOpt[]; defaultAddress?: string;
}) {
  const { locale, tr } = useLocale();
  const [cart, setCart] = useState<Cart | null>(null);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [govId, setGovId] = useState(gov[0]?.id ?? 0);
  const [areaId, setAreaId] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("benefitpay");
  const [useBonus, setUseBonus] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState<Completed | null>(null);
  const toast = useToast();

  useEffect(() => {
    setCart(readCart());
    let live = true;
    fetch("/api/payments/config", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("configuration unavailable");
        return response.json() as Promise<PaymentConfig>;
      })
      .then((data) => {
        if (!live) return;
        setConfig(data);
        const first = PAYMENT_METHODS.find((option) => data.methods[option]?.available);
        if (first) setMethod(first);
      })
      .catch(() => { if (live) setConfig({ ready: false, bonusBalanceFils: 0, methods: {
        card: { enabled: false, configured: false, available: false, ar: OPTIONS.card.ar, en: OPTIONS.card.en },
        benefitpay: { enabled: false, configured: false, available: false, ar: OPTIONS.benefitpay.ar, en: OPTIONS.benefitpay.en },
        cash: { enabled: false, configured: true, available: false, ar: OPTIONS.cash.ar, en: OPTIONS.cash.en },
      } }); });
    return () => { live = false; };
  }, []);

  const areas = gov.find((g) => g.id === govId)?.areas ?? [];
  const area = areas.find((a) => a.id === areaId);
  const subtotal = cartTotal(cart);
  const total = subtotal + (area?.deliveryFeeFils || 0);
  const bonusBalance = userName ? config?.bonusBalanceFils ?? 0 : 0;
  const bonusEstimate = useBonus ? Math.min(bonusBalance, total) : 0;
  const dueEstimate = Math.max(0, total - bonusEstimate);
  const locName = (value: { nameAr: string; nameEn?: string | null }) => locale === "en" ? value.nameEn || value.nameAr : value.nameAr;

  const place = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cart || !area || !config?.methods[method]?.available || !userName || busy) return;
    setBusy(true);
    try {
      const fd = new FormData(event.currentTarget);
      const response = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: cart.storeId, areaId: area.id, address: fd.get("address"), note: fd.get("note"),
          discountCode: code, paymentMethod: method, useBonus,
          items: cart.items.map((line) => ({ itemId: line.itemId, sizeId: line.sizeId, qty: line.qty, addons: line.addonIds })),
        }),
      });
      const result = await response.json();
      if (!response.ok) { toast.show(result.error || tr("تعذّر بدء الطلب", "Could not place the order"), "err"); return; }
      if (result.redirectUrl) { window.location.assign(result.redirectUrl); return; }
      if (result.cash || result.paid) {
        writeCart(null);
        setCompleted({ code: result.code, totalFils: result.totalFils, bonusUsedFils: result.bonusUsedFils ?? 0, amountDueFils: result.amountDueFils ?? 0, cash: Boolean(result.cash), paid: Boolean(result.paid) });
        return;
      }
      toast.show(tr("تعذّر تأكيد حالة الطلب؛ تواصل مع الدعم", "Unable to confirm order; contact support"), "err");
    } catch { toast.show(tr("تعذّر الاتصال. راجع طلباتك قبل إعادة المحاولة.", "Connection failed. Check your orders before retrying."), "err"); }
    finally { setBusy(false); }
  };

  return <CustomerChrome brand={brand} logoOverride={logoOverride} userName={userName}>
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-7 border-b border-[#281044]/12 pb-6">
        <div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.22em] text-[#bb7b1b]"><LockKeyhole size={15} />{tr("إتمام الطلب", "CHECKOUT")}</div>
        <h1 className="font-display text-4xl font-extrabold text-[#281044]">{tr("أوشكنا! خلّينا نوصّل طلبك.", "Almost there. Let's get it to you.")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[#746981]">{tr("اختر عنوانك وطريقة الدفع المتاحة. البطاقة وبنفت باي عبر بوابة Tap الآمنة؛ النقد للمندوب عند الاستلام.", "Choose your delivery address and an available payment method. Cards and BenefitPay use secure Tap checkout; cash is paid on delivery.")}</p>
      </div>
      {completed ? <Card className="mx-auto max-w-xl p-10 text-center"><CheckCircle2 size={54} className="mx-auto text-emerald-500"/><h2 className="mt-4 font-display text-3xl font-extrabold text-[#281044]">{completed.cash && completed.amountDueFils > 0 ? tr("تم تسجيل طلبك!", "Order placed!") : tr("تم تأكيد طلبك!", "Order confirmed!")}</h2><p className="mt-3 font-mono text-sm">{completed.code}</p><p className="mt-3 text-sm text-[#6B5E7A]">{completed.cash && completed.amountDueFils > 0 ? tr("المبلغ المستحق نقداً للمندوب عند الاستلام:", "Cash due to the courier upon delivery:") : tr("تم تسديد قيمة الطلب.", "Your order is fully paid.")}</p>{completed.cash && completed.amountDueFils > 0 && <p className="mt-1 text-lg font-extrabold text-[#281044]">{fmtFils(completed.amountDueFils)}</p>}{completed.bonusUsedFils > 0 && <p className="mt-2 text-sm font-bold text-[#92580e]">{tr("بونس مستخدم:", "Bonus used:")} {fmtFils(completed.bonusUsedFils)}</p>}<Link href="/orders" className="mt-6 inline-block rounded-xl bg-[#281044] px-6 py-3 text-sm font-bold text-white">{tr("تابع طلبك", "Track your order")}</Link></Card>
        : !cart?.items.length ? <Card className="p-10 text-center text-[#756981]">{tr("سلة طلبك فارغة. اختر مطعماً للبدء!", "Your basket is empty. Pick a restaurant to get started!")} <Link href="/" className="font-bold text-[#9a6219] underline">{tr("المطاعم", "Restaurants")}</Link></Card>
        : <form onSubmit={place} className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <Card className="p-5 sm:p-7"><div className="flex items-center gap-2 text-[#281044]"><MapPin size={19} className="text-[#d08c18]"/><h2 className="font-display text-xl font-extrabold">{tr("إلى وين نوصل؟", "Where should we deliver?")}</h2></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label={tr("المحافظة", "Governorate")}><select value={govId} onChange={(event) => { setGovId(Number(event.target.value)); setAreaId(null); }} className={inputCls}>{gov.map((governorate) => <option key={governorate.id} value={governorate.id}>{locName(governorate)}</option>)}</select></Field><Field label={tr("المنطقة", "Area")}><select value={areaId || ""} onChange={(event) => setAreaId(Number(event.target.value))} required className={inputCls}><option value="" disabled>{tr("اختر المنطقة", "Select area")}</option>{areas.map((location) => <option key={location.id} value={location.id}>{locName(location)} · {fmtFils(location.deliveryFeeFils)}</option>)}</select></Field></div><Field label={tr("عنوان التوصيل بالتفصيل", "Full delivery address")} className="mt-4"><input name="address" required minLength={5} defaultValue={defaultAddress} placeholder={tr("الشارع، المبنى، الطابق، الشقة", "Street, building, floor, apartment")} className={inputCls}/></Field><Field label={tr("ملاحظات للمندوب", "Notes for the courier")} className="mt-4"><input name="note" className={inputCls} placeholder={tr("مثلاً: اتصل عند الوصول", "For example: call when you arrive")}/></Field></Card>
            <Card className="p-5 sm:p-7"><div className="flex items-center gap-2 text-[#281044]"><CreditCard size={19} className="text-[#d08c18]"/><h2 className="font-display text-xl font-extrabold">{tr("كيف تحب تدفع؟", "How would you like to pay?")}</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{PAYMENT_METHODS.map((key) => { const option = OPTIONS[key]; const Icon = option.icon; const availability = config?.methods[key]; return <button type="button" key={key} disabled={!availability?.available} onClick={() => setMethod(key)} aria-pressed={method === key && availability?.available} className={`rounded-xl border-2 p-4 text-start transition disabled:cursor-not-allowed disabled:opacity-45 ${method === key && availability?.available ? "border-[#ffc12e] bg-[#fff8e8] shadow-sm" : "border-[#281044]/10 hover:border-[#281044]/30"}`}><Icon size={20} className="mb-2 text-[#a16b15]"/><p className="text-sm font-bold text-[#281044]">{tr(option.ar, option.en)}</p><p className="mt-1 text-xs text-[#70657e]">{tr(option.descAr, option.descEn)}</p>{availability && !availability.available && <p className="mt-2 text-[11px] font-bold text-rose-600">{tr("غير متاح حالياً", "Unavailable now")}</p>}</button>; })}</div><div className="mt-5 flex items-start gap-2 rounded-xl bg-[#f7f3ed] p-3 text-xs leading-6 text-[#6b6177]"><ShieldCheck size={18} className="mt-1 shrink-0 text-emerald-600"/>{tr("بيانات البطاقة لا تُجمع داخل لقمة. إذا اخترت النقد تدفع الباقي للمندوب عند الاستلام.", "Luqma does not collect card details. If you choose cash, pay the remaining amount to the courier upon delivery.")}</div></Card>
            {bonusBalance > 0 && <Card className="border-[#ffc531]/60 bg-[#fff9e9] p-5 sm:p-6"><div className="flex items-center gap-2 text-[#281044]"><Gift size={20} className="text-[#ae7415]"/><h2 className="font-display text-xl font-extrabold">{tr("رصيد البونس الخاص بك", "Your bonus balance")}</h2></div><p className="mt-2 text-2xl font-extrabold text-[#905a10]">{fmtFils(bonusBalance)}</p><label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-[#d29a32]/30 bg-white p-3 text-sm font-bold text-[#281044]"><input type="checkbox" checked={useBonus} onChange={(event) => setUseBonus(event.target.checked)} className="h-4 w-4 accent-[#281044]"/>{tr("استخدم رصيد البونس في هذا الطلب", "Use bonus credit for this order")}</label><p className="mt-2 text-xs leading-6 text-[#716178]">{tr("سيُخصم ما يلزم من رصيدك، والباقي يُدفع بالطريقة المختارة. يُستعاد البونس عند الإلغاء المسموح به.", "Available credit reduces the amount due; pay any remainder with your selected method. Bonus is restored on an eligible cancellation.")}</p></Card>}
          </div>
          <Card className="h-fit overflow-hidden lg:sticky lg:top-24"><div className="border-b border-[#281044]/10 bg-[#281044] px-5 py-4 text-white"><div className="flex items-center gap-2"><ReceiptText size={19} className="text-[#ffc42d]"/><p className="font-display text-lg font-extrabold">{tr("تفاصيل طلبك", "Your order")}</p></div><p className="mt-1 text-xs text-white/60">{cart.storeName}</p></div><div className="p-5"><ul className="divide-y divide-[#281044]/10">{cart.items.map((line, index) => <li key={index} className="flex items-start justify-between gap-3 py-3 text-sm"><div><p className="font-bold text-[#281044]">{line.qty}× {line.name}{line.sizeName ? ` · ${line.sizeName}` : ""}</p>{line.addons.length > 0 && <p className="text-xs text-[#72667e]">+ {line.addons.map((addon) => addon.name).join("، ")}</p>}</div><Price fils={line.lineTotal}/></li>)}</ul><div className="mt-5 space-y-2 border-t border-dashed border-[#281044]/20 pt-4 text-sm"><div className="flex justify-between"><span>{tr("المجموع", "Subtotal")}</span><Price fils={subtotal}/></div><div className="flex justify-between"><span>{tr("رسوم التوصيل", "Delivery fee")}</span><span>{area ? fmtFils(area.deliveryFeeFils) : "—"}</span></div>{useBonus && bonusEstimate > 0 && <div className="flex justify-between font-bold text-emerald-700"><span>{tr("بونس مستخدم (تقديري)", "Bonus used (estimate)")}</span><span>−{fmtFils(bonusEstimate)}</span></div>}<div className="mt-3 flex justify-between border-t border-[#281044]/15 pt-3 font-display text-xl font-extrabold text-[#281044]"><span>{tr("المبلغ المستحق (تقديري)", "Amount due (estimate)")}</span><Price fils={dueEstimate}/></div></div><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder={tr("رمز الخصم (اختياري)", "Promo code (optional)")} className={`${inputCls} mt-5`} /><p className="mt-2 text-[11px] leading-5 text-[#7b7185]">{tr("يتحقق الخادم من الأسعار والخصومات والرصيد النهائي قبل تسجيل الطلب.", "The server verifies final prices, discounts and bonus balance before placing your order.")}</p>{config && !config.ready && <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">{tr("جميع وسائل الدفع غير متاحة حالياً؛ تواصل مع الدعم.", "All payment methods are unavailable right now; contact support.")}</div>}{!userName && <Link href="/auth" className="mt-4 block text-center text-xs font-bold text-[#8a571a] underline">{tr("سجّل دخولك أولاً", "Sign in to continue")}</Link>}<Btn type="submit" disabled={busy || !userName || !area || !config?.methods[method]?.available} className="mt-5 w-full py-3.5 text-base">{busy ? tr("جارٍ تسجيل طلبك…", "Placing your order…") : method === "cash" ? tr("تأكيد الطلب والدفع عند الاستلام", "Place order · pay on delivery") : tr("المتابعة للدفع الآمن", "Continue to secure payment")}</Btn><p className="mt-3 text-center text-[11px] text-[#7b7185]">{tr("يمكنك إلغاء الطلب خلال ٥ دقائق مع ذكر السبب", "Cancel within 5 minutes with a reason")}</p></div></Card>
        </form>}
    </div>{toast.node}
  </CustomerChrome>;
}
