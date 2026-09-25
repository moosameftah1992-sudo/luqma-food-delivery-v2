"use client";

import { useEffect, useState } from "react";
import { Banknote, CreditCard, Gift, ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-types";
import { Spinner } from "@/components/ui";

type Availability = {
  tapConfigured: boolean;
  methods: Record<PaymentMethod, { enabled: boolean; configured: boolean; available: boolean; ar: string; en: string }>;
};

const DESCRIPTIONS: Record<PaymentMethod, { ar: string; en: string }> = {
  card: { ar: "فيزا وماستركارد عبر صفحة Tap الآمنة", en: "Visa & Mastercard via secure Tap checkout" },
  benefitpay: { ar: "الدفع عبر تطبيق بنفت باي", en: "Pay with the BenefitPay app" },
  cash: { ar: "يدفع العميل المبلغ المتبقي عند الاستلام", en: "Customer pays the remaining amount upon delivery" },
};
const ICONS = { card: CreditCard, benefitpay: Smartphone, cash: Banknote };

export function AdminPaymentMethods() {
  const { locale, tr } = useLocale();
  const [data, setData] = useState<Availability | null>(null);
  const [busy, setBusy] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/payment-methods", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "تعذّر تحميل وسائل الدفع"); if (!controller.signal.aborted) setData(payload); })
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "تعذّر تحميل وسائل الدفع"); });
    return () => controller.abort();
  }, []);
  async function toggle(method: PaymentMethod) {
    if (!data || busy) return;
    setBusy(method); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/payment-methods", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, enabled: !data.methods[method].enabled }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذّر تحديث وسيلة الدفع");
      setData(payload);
      setNotice(tr("تم تحديث وسيلة الدفع، وسيُطبّق القرار على الطلبات الجديدة فوراً.", "Payment method updated. New checkouts reflect the change immediately."));
    } catch (err) { setError(err instanceof Error ? err.message : "تعذّر التحديث"); }
    finally { setBusy(null); }
  }
  return <div className="mx-auto max-w-5xl space-y-6">
    <div><span className="text-[11px] font-extrabold uppercase tracking-[.24em] text-[#ffc531]">PAYMENT CONTROL</span><h1 className="mt-2 font-display text-3xl font-extrabold text-white">{tr("وسائل الدفع المتاحة", "Payment methods")}</h1><p className="mt-2 text-sm leading-6 text-white/55">{tr("حدد وسائل الدفع المتاحة في صفحة العميل. لا يُغيّر هذا الطلبات السابقة أو أرصدة البونس.", "Choose which options appear at checkout. Previous orders and bonus balances remain unchanged.")}</p></div>
    {error && <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-4 text-sm font-bold text-rose-200">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">{notice}</p>}
    {!data ? <Spinner label={tr("جارٍ تحميل وسائل الدفع…", "Loading payment methods…")} /> : <>
      <div className="grid gap-4 md:grid-cols-3">{PAYMENT_METHODS.map((method) => {
        const value = data.methods[method]; const Icon = ICONS[method];
        return <article key={method} className="rounded-2xl border border-white/10 bg-[#291047] p-5 shadow-xl shadow-black/10"><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#ffc531]/15 text-[#ffc531]"><Icon size={21}/></span><span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${value.enabled ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/50"}`}>{value.enabled ? tr("متاح", "Enabled") : tr("غير متاح", "Disabled")}</span></div><h2 className="mt-5 font-display text-xl font-extrabold text-white">{locale === "en" ? value.en : value.ar}</h2><p className="mt-2 min-h-11 text-xs leading-6 text-white/55">{tr(DESCRIPTIONS[method].ar, DESCRIPTIONS[method].en)}</p><button type="button" role="switch" aria-checked={value.enabled} disabled={busy !== null} onClick={() => void toggle(method)} className={`mt-5 flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${value.enabled ? "bg-[#ffc531] text-[#281044]" : "border border-white/25 text-white hover:border-[#ffc531]"}`}><span>{value.enabled ? tr("إيقاف الوسيلة", "Disable method") : tr("تفعيل الوسيلة", "Enable method")}</span><span className={`relative h-5 w-9 rounded-full ${value.enabled ? "bg-[#281044]" : "bg-white/25"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${value.enabled ? "end-0.5" : "start-0.5"}`}/></span></button>{method !== "cash" && value.enabled && !value.configured && <p className="mt-3 flex gap-2 rounded-lg bg-amber-400/10 p-2.5 text-[11px] leading-5 text-amber-200"><TriangleAlert size={14} className="mt-0.5 shrink-0"/>{tr("يلزم ربط Tap لإتمام هذا الدفع؛ لن يظهر متاحاً للعميل قبل ذلك.", "Tap credentials are required before this option can accept payments.")}</p>}</article>;
      })}</div>
      {!Object.values(data.methods).some((method) => method.available) && <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-400/35 bg-rose-400/10 p-4 text-sm text-rose-100"><TriangleAlert size={19} className="shrink-0"/>{tr("جميع وسائل الدفع غير متاحة حالياً؛ لن يستطيع العملاء إكمال طلب جديد حتى تفعّل وسيلة تعمل.", "No payment method is currently available. Customers cannot complete new orders until one is enabled and working.")}</div>}
      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-5 text-xs leading-6 text-white/60"><ShieldCheck size={20} className="shrink-0 text-[#ffc531]"/><p>{tr("البونس وسيلة لتخفيض المبلغ المستحق، وليس بديلاً عن إعداد وسائل الدفع. الخصم من رصيد العميل يُسجَّل ويُستعاد عند إلغاء الطلب حسب السياسة.", "Bonus credit reduces the payable amount. Deductions are recorded and restored when an order is cancelled under the policy.")}</p></div>
    </>}
  </div>;
}
