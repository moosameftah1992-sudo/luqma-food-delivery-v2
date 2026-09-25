"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand";
import { LanguageSwitch, useLocale } from "@/components/locale-provider";
import { Btn, Card } from "@/components/ui";

type Role = "customer" | "driver";
export function VerifyEmail({ role, token, logoOverride }: { role: Role; token: string; logoOverride?: string }) {
  const { tr } = useLocale();
  const [state, setState] = useState<"idle" | "busy" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  async function verify() {
    if (!token) return;
    setState("busy");
    try {
      const res = await fetch(`/api/auth/${role}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await res.json();
      setState(res.ok ? "success" : "error");
      setMessage(data.message || data.error || "تعذّر التحقق");
      if (res.ok) window.history.replaceState({}, "", "/verify");
    } catch { setState("error"); setMessage("تعذّر الاتصال بالخادم. حاول مجدداً."); }
  }
  return <div className="min-h-screen bg-[#1B0733] px-5 py-8" dir={tr("rtl", "ltr")}>
    <header className="mx-auto flex max-w-4xl items-center justify-between"><Link href="/"><Logo size={42} tone="light" override={logoOverride} /></Link><LanguageSwitch /></header>
    <main className="mx-auto mt-16 max-w-lg"><Card className="p-8 text-center sm:p-12"><div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#ffbc30]/20 text-3xl">✉</div><h1 className="font-display text-3xl font-extrabold text-[#24103E]">{tr("تأكيد البريد الإلكتروني", "Verify your email")}</h1><p className="mt-3 text-sm leading-7 text-[#6B5E7A]">{role === "driver" ? tr("بعد تأكيد البريد، تنتظر موافقة إدارة لقمة النهائية على وثائقك.", "After verifying your email, your documents still require final approval from Luqma.") : tr("أكد عنوان بريدك لتفعيل حساب العميل والبدء بطلب الطعام.", "Confirm your email to activate your customer account and start ordering.")}</p>
      {state === "success" ? <div className="mt-7 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{tr(message, role === "driver" ? "Email confirmed. Awaiting admin approval." : "Email confirmed. Your account is active.")}</div> : state === "error" || !token ? <div className="mt-7 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{tr(message || "الرابط غير صالح. اطلب رابطاً جديداً من صفحة الدخول.", "This link is invalid or expired. Request a new link from sign in.")}</div> : <Btn className="mt-8 w-full py-3.5" onClick={verify} disabled={state === "busy"}>{state === "busy" ? tr("جارٍ التأكيد…", "Verifying…") : tr("تأكيد عنوان بريدي", "Confirm my email")}</Btn>}
      <Link href={role === "driver" ? "/driver" : "/auth"} className="mt-6 block text-sm font-bold text-[#281044] underline underline-offset-4">{tr("العودة لتسجيل الدخول", "Back to sign in")}</Link>
    </Card></main>
  </div>;
}
