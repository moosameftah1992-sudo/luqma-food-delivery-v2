"use client";

import Link from "next/link";
import { useState } from "react";
import { UploadCloud, ShieldCheck, MailCheck, Bike, ArrowUpRight } from "lucide-react";
import { BrandLockup, Logo } from "@/components/brand";
import { useLocale, LanguageSwitch } from "@/components/locale-provider";
import { Btn, Card, Field, inputCls } from "@/components/ui";
import type { Brand } from "@/lib/brand";

type Phase = "form" | "email" | "review";
async function imageData(file: File | null): Promise<string> {
  if (!file) throw new Error("أرفق صورة الهوية والرخصة");
  if (!/^(image\/(png|jpeg|webp)|application\/pdf)$/.test(file.type) || file.size > 950_000)
    throw new Error("الصيغ المقبولة JPG/PNG/WEBP/PDF والحجم الأقصى 950 كيلوبايت لكل ملف");
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("تعذر قراءة الملف")); reader.readAsDataURL(file); });
}

export function DriverAuth({ brand, logoOverride, onDone }: { brand: Brand; logoOverride?: string; onDone: () => void }) {
  const { tr } = useLocale();
  const [tab, setTab] = useState<"register" | "login">("register");
  const [phase, setPhase] = useState<Phase>("form");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setNotice(""); setBusy(true);
    const fd = new FormData(event.currentTarget);
    try {
      const body: Record<string, unknown> = Object.fromEntries(fd.entries());
      if (tab === "register") {
        const files = fd.getAll("idCardData");
        const licenses = fd.getAll("licenseData");
        body.idCardData = await imageData(files[0] instanceof File ? files[0] : null);
        body.licenseData = await imageData(licenses[0] instanceof File ? licenses[0] : null);
        body.terms = fd.get("terms") === "on";
      }
      const res = await fetch(`/api/auth/driver/${tab}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "تعذّر إتمام العملية"); if (data.needsVerification) setPhase("email"); else if (data.pending) setPhase("review"); return; }
      if (tab === "register") { setPhase("email"); setNotice(data.message); } else onDone();
    } catch (err) { setError(err instanceof Error ? err.message : "تعذّر الاتصال بالخادم"); }
    finally { setBusy(false); }
  };
  async function resend() {
    if (!email || busy) return;
    setBusy(true); setError("");
    try { const res = await fetch("/api/auth/driver/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); const result = await res.json(); if (res.ok) setNotice(result.message); else setError(result.error); }
    catch { setError("تعذّر الإرسال، حاول مجدداً"); } finally { setBusy(false); }
  }

  return <div className="relative isolate min-h-screen bg-[#1B0733] text-white"><img src="/images/driver-night.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-35"/><div className="absolute inset-0 bg-gradient-to-l from-[#1B0733]/70 via-[#1B0733]/80 to-[#1B0733]"/>
    <div className="relative mx-auto max-w-6xl px-5 py-6"><header className="flex items-center justify-between gap-3"><Link href="/"><Logo size={42} tone="light" override={logoOverride}/></Link><div className="flex items-center gap-3"><LanguageSwitch/><Link href="/" className="text-xs font-bold text-white/70 hover:text-[#ffbd2d]">{tr("الرئيسية", "Home")}</Link></div></header>
      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_510px] lg:gap-16"><div className="pt-8"><div className="mb-6 hidden lg:block"><BrandLockup override={logoOverride} className="items-start"/></div><p className="text-xs font-extrabold uppercase tracking-[.25em] text-[#ffc42d]">LUQMA COURIER PARTNERS</p><h1 className="mt-4 font-display text-5xl font-extrabold leading-[1.03] lg:text-6xl">{tr("مشوارك يبدأ من هنا.", "Your journey starts here.")}</h1><p className="mt-5 max-w-lg text-base leading-8 text-white/65">{tr("سجّل بياناتك ووثائقك، أكد بريدك الإلكتروني، وبعد موافقة الإدارة ابدأ في استقبال طلبات التوصيل.", "Submit your details and documents, verify your email, and start receiving deliveries after final approval.")}</p><div className="mt-8 flex flex-wrap gap-3">{[{icon:MailCheck, ar:"تحقق بريدي آمن",en:"Verified email"},{icon:ShieldCheck, ar:"مراجعة وثائق",en:"Document review"},{icon:Bike,ar:"مرونة في العمل",en:"Work flexibly"}].map(x=><span key={x.en} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-bold text-white/80"><x.icon size={15} className="text-[#ffc42d]"/>{tr(x.ar,x.en)}</span>)}</div></div>
      <Card className="overflow-hidden border-white/10 p-0 shadow-[0_28px_80px_-25px_rgba(0,0,0,.65)]"><div className="h-1.5 bg-gradient-to-l from-[#ffc42d] to-[#ff7219]"/><div className="p-6 sm:p-8"><div className="flex gap-1 rounded-xl bg-[#f4eff7] p-1">{(["register","login"] as const).map(k=><button key={k} onClick={()=>{setTab(k);setPhase("form");setError("");setNotice("");}} type="button" className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-extrabold ${tab===k?"bg-[#281044] text-white":"text-[#6B5E7A]"}`}>{k === "register" ? tr("انضم كمندوب", "Join as courier") : tr("تسجيل الدخول", "Sign in")}</button>)}</div>
      {phase === "form" ? <form onSubmit={submit} className="mt-6 space-y-3.5">{tab === "register" && <><Field label={tr("الاسم الكامل", "Full name")}><input name="name" required minLength={2} className={inputCls}/></Field><div className="grid grid-cols-2 gap-3"><Field label={tr("رقم الهوية", "ID card number")}><input name="idCardNumber" required className={inputCls} dir="ltr"/></Field><Field label={tr("رقم رخصة القيادة", "Driving licence number")}><input name="licenseNumber" required className={inputCls} dir="ltr"/></Field></div><div className="grid grid-cols-2 gap-3"><Field label={tr("صورة الهوية", "ID card document")}><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#281044]/25 bg-[#f8f4f0] px-3 py-3 text-xs font-bold text-[#281044]"><UploadCloud size={18}/>{tr("اختر ملفاً", "Choose file")}<input name="idCardData" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required className="max-w-[95px] text-[10px]"/></label></Field><Field label={tr("صورة الرخصة", "Licence document")}><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#281044]/25 bg-[#f8f4f0] px-3 py-3 text-xs font-bold text-[#281044]"><UploadCloud size={18}/>{tr("اختر ملفاً", "Choose file")}<input name="licenseData" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required className="max-w-[95px] text-[10px]"/></label></Field></div><p className="text-xs text-[#6B5E7A]">{tr("JPG/PNG/WEBP/PDF — أقل من 950 كيلوبايت للملف", "JPG/PNG/WEBP/PDF — under 950 KB per file")}</p></>}
      <Field label={tr("البريد الإلكتروني", "Email address")}><input name="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required className={inputCls} dir="ltr" autoComplete="email"/></Field>{tab === "register" && <Field label={tr("رقم الهاتف", "Phone number")}><input name="phone" type="tel" required minLength={8} className={inputCls} dir="ltr"/></Field>}<Field label={tr("كلمة المرور", "Password")}><input name="password" type="password" required minLength={tab === "register" ? 10 : 1} className={inputCls} dir="ltr" autoComplete={tab === "login" ? "current-password" : "new-password"}/></Field>{tab === "register" && <label className="flex items-start gap-2.5 text-xs leading-5 text-[#625472]"><input name="terms" type="checkbox" required className="mt-1 accent-[#281044]"/>{tr("أوافق على الشروط والأحكام وأؤكد صحة بيانات الهوية والرخصة.", "I accept the terms and confirm my ID and licence details are accurate.")}</label>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<Btn type="submit" disabled={busy} className="w-full py-3">{busy ? tr("لحظات…", "Please wait…") : tab === "login" ? tr("الدخول", "Sign in") : tr("إرسال الطلب ورابط التحقق", "Apply & send verification")}</Btn></form> : <div className="mt-7 rounded-2xl bg-[#f8f4ed] p-6 text-center text-[#281044]"><span className="text-4xl">{phase === "email" ? "✉" : "✓"}</span><h2 className="mt-3 font-display text-xl font-extrabold">{phase === "email" ? tr("تحقق من بريدك الإلكتروني", "Check your inbox") : tr("بانتظار موافقة الإدارة", "Awaiting final approval")}</h2><p className="mt-2 text-sm leading-6 text-[#6B5E7A]">{tr(phase === "email" ? "أرسلنا رابطاً إلى البريد المسجل. بعد فتحه تُراجع الإدارة وثائقك للموافقة النهائية." : "تم تأكيد بريدك. ستتمكن من الدخول بعد مراجعة الإدارة لبطاقة الهوية والرخصة.",phase === "email" ? "We sent a link to your email. After confirmation, admin will review your documents." : "Your email is verified. Admin will review your documents before activating your account.")}</p>{phase === "email" && <button onClick={resend} disabled={busy} className="mt-5 text-sm font-bold text-[#8b5514] underline underline-offset-4">{tr("إعادة إرسال رابط التحقق", "Resend verification email")}</button>}<button onClick={()=>{setTab("login");setPhase("form");setError("");}} className="mt-4 block w-full text-sm font-bold text-[#281044]">{tr("العودة لتسجيل الدخول", "Back to sign in")} ↗</button></div>}{notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}</div></Card></div></div>
  </div>;
}
