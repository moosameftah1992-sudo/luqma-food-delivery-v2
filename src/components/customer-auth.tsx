"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandLockup, Logo } from "@/components/brand";
import { LanguageSwitch, useLocale } from "@/components/locale-provider";
import { Btn, Card, Field, inputCls } from "@/components/ui";
import type { GovOpt } from "@/components/customer-home";
import type { Brand } from "@/lib/brand";

type AuthTab = "login" | "register";
export function CustomerAuth({ brand, logoOverride, gov }: { brand: Brand; logoOverride?: string; gov: GovOpt[]; initialToken?: string }) {
  const { tr, locale } = useLocale();
  const [tab, setTab] = useState<AuthTab>("login");
  const [govId, setGovId] = useState(gov[0]?.id ?? 0);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [busy, setBusy] = useState(false);
  const areas = gov.find((g) => g.id === govId)?.areas ?? [];

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const res = await fetch(`/api/auth/customer/${tab}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "حدث خطأ. حاول مرة أخرى."); setNeedsVerification(Boolean(data.needsVerification)); return; }
      if (tab === "register") { setMessage(data.message); setNeedsVerification(true); setTab("login"); }
      else window.location.href = "/";
    } catch { setError(tr("تعذّر الاتصال بالخادم. حاول مجدداً.", "Could not connect. Please try again.")); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    if (!email) { setError(tr("أدخل البريد الإلكتروني أولاً.", "Enter your email first.")); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/auth/customer/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (res.ok) setMessage(data.message); else setError(data.error);
    } catch { setError(tr("تعذّر إرسال الرابط حالياً.", "Unable to resend right now.")); }
    finally { setBusy(false); }
  };
  return <div className="min-h-screen bg-[#1B0733] text-white">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><Link href="/"><Logo size={42} tone="light" override={logoOverride} /></Link><div className="flex items-center gap-4"><LanguageSwitch /><Link href="/" className="text-sm text-white/65 hover:text-[#ffc62e]">{tr("العودة للمطاعم", "Explore restaurants")}</Link></div></header>
    <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-8 lg:grid-cols-[1fr_510px] lg:items-center">
      <div className="relative hidden overflow-hidden rounded-[36px] border border-white/10 bg-[#281044] px-8 py-12 shadow-2xl lg:block"><div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#ffac12]/15 blur-3xl" /><BrandLockup override={logoOverride} className="relative" /><div className="relative mt-10 h-px bg-gradient-to-l from-transparent via-[#ffc62e] to-transparent" /><h1 className="relative mt-8 text-center font-display text-4xl font-extrabold leading-tight">{tr("كل لقمة لها حكاية.", "Good food. Great moments.")}</h1><p className="relative mt-3 text-center text-white/65">{tr("مطاعمك المفضّلة، إلى بابك.", "Your favorite kitchens, right to your door.")}</p></div>
      <Card className="overflow-hidden border-white/5 p-0"><div className="h-1.5 bg-gradient-to-l from-[#ffc729] to-[#ff7214]"/><div className="p-6 sm:p-9"><p className="text-xs font-extrabold uppercase tracking-[.25em] text-[#bd7813]">{tr("حساب لقمة", "YOUR LUQMA ACCOUNT")}</p><h2 className="mt-2 font-display text-3xl font-extrabold text-[#281044]">{tr(tab === "login" ? "ياهلا فيك من جديد" : "ابدأ رحلتك مع لقمة", tab === "login" ? "Welcome back" : "Join Luqma today")}</h2>
      <div className="mt-6 grid grid-cols-2 rounded-xl bg-[#f6f1ec] p-1">{(["login", "register"] as const).map(k=><button key={k} type="button" onClick={()=>{setTab(k);setError("");setMessage("");}} className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${tab===k?"bg-[#281044] text-white shadow":"text-[#766681]"}`}>{k === "login" ? tr("تسجيل الدخول", "Sign in") : tr("حساب جديد", "Create account")}</button>)}</div>
      <form onSubmit={submit} className="mt-6 space-y-4">{tab === "register" && <><Field label={tr("الاسم الكامل", "Full name")}><input name="name" required minLength={2} className={inputCls} autoComplete="name" /></Field><Field label={tr("رقم الهاتف", "Phone number")}><input name="phone" required minLength={8} type="tel" className={inputCls} dir="ltr" autoComplete="tel" /></Field></>}
      <Field label={tr("البريد الإلكتروني", "Email address")}><input name="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required className={inputCls} dir="ltr" autoComplete="email" placeholder="name@example.com" /></Field><Field label={tr("كلمة المرور", "Password")} hint={tab === "register" ? tr("10 أحرف على الأقل", "At least 10 characters") : undefined}><input name="password" type="password" required minLength={tab === "register" ? 10 : 1} className={inputCls} dir="ltr" autoComplete={tab === "register" ? "new-password" : "current-password"} /></Field>
      {tab === "register" && <><div className="grid gap-3 sm:grid-cols-2"><Field label={tr("المحافظة", "Governorate")}><select className={inputCls} value={govId} onChange={e=>setGovId(Number(e.target.value))}>{gov.map(g=><option key={g.id} value={g.id}>{locale === "en" ? g.nameEn || g.nameAr : g.nameAr}</option>)}</select></Field><Field label={tr("المنطقة", "Area")}><select name="areaId" required className={inputCls} defaultValue="" key={govId}><option value="" disabled>{tr("اختر المنطقة", "Select area")}</option>{areas.map(a=><option key={a.id} value={a.id}>{locale === "en" ? a.nameEn || a.nameAr : a.nameAr}</option>)}</select></Field></div><Field label={tr("عنوان التوصيل", "Delivery address")}><input name="address" className={inputCls} placeholder={tr("المبنى، الشارع، رقم الشقة", "Building, street, apartment")} /></Field></>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}{message && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</p>}
      <Btn type="submit" disabled={busy} className="w-full py-3.5 text-base">{busy ? tr("لحظات…", "Please wait…") : tab === "login" ? tr("تسجيل الدخول", "Sign in") : tr("إنشاء الحساب وإرسال رابط التحقق", "Create account & send verification")}</Btn></form>
      {needsVerification && <button type="button" onClick={resend} disabled={busy} className="mt-5 w-full text-center text-sm font-bold text-[#8c5513] underline underline-offset-4 disabled:opacity-50">{tr("لم يصلك البريد؟ أعد إرسال رابط التحقق", "No email? Resend verification link")}</button>}
      <p className="mt-6 text-center text-xs leading-6 text-[#81768a]">{tr("بالتسجيل، أنت توافق على الشروط والأحكام وسياسة الخصوصية.", "By joining, you agree to our Terms & Privacy Policy.")}</p></div></Card>
    </div></div>;
}
