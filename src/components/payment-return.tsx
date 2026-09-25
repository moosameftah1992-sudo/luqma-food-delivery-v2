"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, XCircle, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand";
import { LanguageSwitch, useLocale } from "@/components/locale-provider";
import { writeCart } from "@/lib/cart";
import { fmtFils } from "@/lib/util";
import type { Brand } from "@/lib/brand";

export function PaymentReturn({ brand, code, tapId }: { brand: Brand; code: string; tapId: string }) {
  const { tr } = useLocale();
  const [status, setStatus] = useState<"checking" | "initiated" | "captured" | "failed" | "error">("checking");
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!code || !tapId) { setStatus("error"); return; }
    let stopped = false; let count = 0; let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/payments/status?order=${encodeURIComponent(code)}&tap_id=${encodeURIComponent(tapId)}`, { cache: "no-store" });
        const data = await res.json();
        if (stopped) return;
        if (!res.ok) { setStatus("error"); return; }
        setTotal(data.totalFils);
        if (data.status === "captured") { setStatus("captured"); writeCart(null); window.history.replaceState({}, "", `/payment/return?order=${encodeURIComponent(code)}`); return; }
        if (data.status === "failed") { setStatus("failed"); return; }
        setStatus("initiated");
        if (++count < 12) timer = setTimeout(poll, 2500);
      } catch { if (!stopped) setStatus("error"); }
    }
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [code, tapId]);
  const ok = status === "captured";
  return <main className="min-h-screen bg-[#1B0733] px-5 py-8 text-white"><header className="mx-auto flex max-w-4xl items-center justify-between"><Link href="/"><Logo tone="light" override={brand.logoUrl || undefined}/></Link><LanguageSwitch/></header><div className="mx-auto mt-20 max-w-lg overflow-hidden rounded-3xl bg-white text-center text-[#281044] shadow-2xl"><div className={`h-2 ${ok ? "bg-emerald-500" : status === "failed" ? "bg-rose-500" : "bg-gradient-to-r from-[#ffc52c] to-[#ff7215]"}`}/><div className="p-9 sm:p-12">{ok ? <CheckCircle2 size={58} className="mx-auto text-emerald-500"/> : status === "failed" ? <XCircle size={58} className="mx-auto text-rose-500"/> : <Clock3 size={58} className="mx-auto animate-pulse text-[#d88b19]"/>}<h1 className="mt-5 font-display text-3xl font-extrabold">{ok ? tr("تم تأكيد الدفع والطلب!", "Payment confirmed!") : status === "failed" ? tr("لم تكتمل عملية الدفع", "Payment was not completed") : status === "error" ? tr("تعذّر التحقق حالياً", "Unable to verify payment") : tr("جارٍ التحقق من الدفع…", "Verifying your payment…")}</h1><p className="mt-3 text-sm leading-7 text-[#766681]">{ok ? tr("وصل طلبك إلى المتجر. يمكنك متابعة حالته لحظة بلحظة.", "Your order has been sent to the restaurant. Track it live below.") : status === "failed" ? tr("لم يصل المبلغ للمتجر. يمكنك المحاولة مجدداً.", "No order was placed. You can try again.") : tr("نتحقق من حالة العملية لدى بوابة الدفع مباشرةً. لا تُعد إرسال الطلب.", "We're confirming the result with the payment provider. Please don't place a duplicate order.")}</p>{code && <p className="mt-4 font-mono text-sm font-bold" dir="ltr">{code}</p>}{ok && <p className="mt-3 font-extrabold text-[#b47712]">{fmtFils(total)}</p>}<div className="mt-8 flex gap-3"><Link href="/orders" className="flex-1 rounded-xl bg-[#281044] px-4 py-3 text-sm font-bold text-white">{tr("طلباتي", "My orders")}</Link><Link href={ok ? "/" : "/checkout"} className="flex-1 rounded-xl border border-[#281044]/20 px-4 py-3 text-sm font-bold">{ok ? tr("المطاعم", "Restaurants") : tr("إعادة المحاولة", "Try again")}</Link></div></div></div></main>;
}
