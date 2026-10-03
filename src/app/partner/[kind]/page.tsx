"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Btn, Field, inputCls, Logo, LangToggle, Spinner, ImageUpload, Badge } from "@/components/ui";
import { useL } from "@/lib/i18n";

export default function PartnerPage() {
  const { kind } = useParams<{ kind: string }>();
  const isStore = kind === "store";
  const router = useRouter();
  const { s } = useL();
  const [tab, setTab] = useState<"login" | "register">("register");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [dev, setDev] = useState<any>(null);
  const [verified, setVerified] = useState(false);
  const [locations, setLocations] = useState<any>(null);
  const [cats, setCats] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [f, setF] = useState({
    name: "", nameAr: "", nameEn: "", email: "", phone: "", password: "",
    description: "", categoryId: "", governorateId: "", areaId: "",
    logoUrl: "", bannerUrl: "", idCardUrl: "", licenseUrl: "", vehicle: "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    fetch("/api/stores").then((r) => r.json()).then((j) => setCats(j.categories || []));
    fetch("/api/locations").then((r) => r.json()).then((j) => setLocations(j)).catch(() => {});
  }, []);

  const post = async (body: any) => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.error) setErr(j.error);
      return j;
    } finally {
      setBusy(false);
    }
  };

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const j = await post({ action: "login", role: isStore ? "store" : "driver", identifier: f.email, password: f.password });
    if (!j) return;
    if (j.pendingApproval) {
      setInfo(s("حسابك قيد المراجعة — سيُفعَّل بعد موافقة الإدارة", "Your account is under review and will activate after admin approval"));
      return;
    }
    if (j.ok) router.push(isStore ? "/store" : "/driver");
  };

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password.length < 8) {
      setErr(s("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "Password must be at least 8 characters"));
      return;
    }
    if (isStore && (!f.nameAr.trim() || !f.email)) return;
    if (!isStore && !f.idCardUrl) {
      setErr(s("يجب رفع صورة بطاقة الهوية", "You must upload your ID card"));
      return;
    }
    if (!isStore && !f.licenseUrl) {
      setErr(s("يجب رفع صورة رخصة القيادة", "You must upload your driving license"));
      return;
    }
    const j = await post({
      action: "register",
      role: isStore ? "store" : "driver",
      name: isStore ? f.nameAr || f.name : f.name,
      email: f.email, phone: f.phone, password: f.password,
      ...(isStore ? { nameAr: f.nameAr, nameEn: f.nameEn || f.nameAr, description: f.description, categoryId: f.categoryId || null, governorateId: f.governorateId || null, areaId: f.areaId || null, logoUrl: f.logoUrl || null, bannerUrl: f.bannerUrl || null } : { vehicle: f.vehicle, idCardUrl: f.idCardUrl || null, licenseUrl: f.licenseUrl || null }),
    });
    if (!j) return;
    if (j.needVerify) {
      setDev(j.dev);
      setInfo(s("تم استلام طلبك! أرسلنا رمز تفعيل إلى بريدك.", "Application received! A verification code was emailed to you."));
      setVerified(false);
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const j = await post({ action: "verify", email: f.email || undefined, code: code || undefined, token: dev?.token });
    if (!j) return;
    setVerified(true);
    setInfo(s("تم تفعيل بريدك بنجاح! حسابك الآن قيد الموافقة من الإدارة.", "Email verified! Your account is now awaiting admin approval."));
  };

  const shell = () => (
    <div className="relative min-h-screen bg-royal-950">
      <div className="absolute inset-0 opacity-50" style={{ background: "radial-gradient(800px 400px at 80% 0%, rgba(247,181,0,0.15), transparent 60%), radial-gradient(700px 400px at 10% 100%, rgba(109,63,160,0.4), transparent 60%)" }} />
      <div className="relative mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <LinkHome />
          <LangToggle />
        </div>
        <div className="mb-6 flex items-center gap-4">
          <Logo size={56} withText={false} />
          <div>
            <h1 className="text-2xl font-black text-white">
              {isStore ? s("انضم كشريك (مطعم)", "Become a partner (restaurant)") : s("انضم كمندوب توصيل", "Become a delivery driver")}
            </h1>
            <p className="mt-1 text-xs text-white/55">
              {isStore
                ? s("افتح مطعمك على لقمة وابدأ باستقبال الطلبات", "Open your restaurant on Luqma and start receiving orders")
                : s("سجّل وثائقك وسنوافي بالموافقة فوراً بعد المراجعة", "Submit your documents and we'll approve you right after review")}
            </p>
          </div>
        </div>

        <div className="mb-5 flex gap-2">
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setErr(""); setInfo(""); }}
              className={`rounded-full px-5 py-2 text-xs font-black transition ${tab === t ? "bg-gold-500 text-royal-950" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
            >
              {t === "login" ? s("تسجيل الدخول", "Log in") : s("طلب الانضمام", "Apply")}
            </button>
          ))}
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-2xl fade-up">
          {err && <div className="mb-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-600">{err}</div>}
          {info && <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 flex items-center gap-2">{info} {tab === "register" && !verified && <Badge tone="gold">{s("بانتظار الموافقة", "Pending approval")}</Badge>}</div>}

          {tab === "login" && (
            <form onSubmit={onLogin} className="space-y-3">
              <Field label={s("البريد الإلكتروني", "Email")}>
                <input dir="ltr" className={inputCls} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} required />
              </Field>
              <Field label={s("كلمة المرور", "Password")}>
                <input dir="ltr" className={inputCls} type="password" value={f.password} onChange={(e) => set("password", e.target.value)} required />
              </Field>
              <Btn type="submit" variant="purple" className="w-full" disabled={busy}>{busy ? <Spinner /> : s("دخول", "Sign in")}</Btn>
              <p className="text-center text-xs text-gray-500">
                <button type="button" className="font-black text-gold-600 hover:underline" onClick={async () => {
                  const j = await post({ action: "forgot", email: f.email });
                  if (j) { setDev(j.dev); setInfo(s("أرسلنا رابط الاستعادة إلى بريدك", "A reset link was emailed to you")); }
                }}>
                  {s("نسيت كلمة المرور؟", "Forgot password?")}
                </button>
              </p>
            </form>
          )}

          {tab === "register" && !verified && (
            <form onSubmit={onRegister} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={isStore ? s("اسم المطعم (عربي)", "Restaurant name (Arabic)") : s("الاسم الكامل", "Full name")}>
                  <input className={inputCls} value={f.nameAr || f.name} onChange={(e) => set(isStore ? "nameAr" : "name", e.target.value)} required />
                </Field>
                <Field label={isStore ? s("اسم المطعم (إنجليزي)", "Restaurant name (English)") : s("رقم الهاتف", "Phone")}>
                  <input dir={isStore ? "ltr" : "ltr"} className={inputCls} value={isStore ? f.nameEn : f.phone} onChange={(e) => set(isStore ? "nameEn" : "phone", e.target.value)} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={s("البريد الإلكتروني", "Email")}>
                  <input dir="ltr" className={inputCls} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} required />
                </Field>
                <Field label={s("كلمة المرور (8 أحرف على الأقل)", "Password (min 8 chars)")}>
                  <input dir="ltr" className={inputCls} type="password" value={f.password} onChange={(e) => set("password", e.target.value)} minLength={8} required />
                </Field>
              </div>

              {isStore && (
                <>
                  <Field label={s("وصف مختصر للمطعم", "Short description")}>
                    <input className={inputCls} value={f.description} onChange={(e) => set("description", e.target.value)} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label={s("التصنيف", "Category")}>
                      <select className={inputCls} value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                        <option value="">{s("— اختر —", "— select —")}</option>
                        {cats.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
                      </select>
                    </Field>
                    <Field label={s("المحافظة", "Governorate")}>
                      <select className={inputCls} value={f.governorateId} onChange={(e) => set("governorateId", e.target.value)}>
                        <option value="">{s("— اختر —", "— select —")}</option>
                        {(locations?.governorates || []).map((g: any) => <option key={g.id} value={g.id}>{g.nameAr}</option>)}
                      </select>
                    </Field>
                    <Field label={s("المنطقة", "Area")}>
                      <select className={inputCls} value={f.areaId} onChange={(e) => set("areaId", e.target.value)} disabled={!f.governorateId}>
                        <option value="">{s("— اختر —", "— select —")}</option>
                        {(locations?.areas || []).filter((a: any) => String(a.governorateId) === f.governorateId).map((a: any) => <option key={a.id} value={a.id}>{a.nameAr}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ImageUpload label={s("شعار المطعم (اللوقو)", "Restaurant logo")} value={f.logoUrl} onChange={(u) => set("logoUrl", u)} />
                    <ImageUpload label={s("صورة البانر الرئيسية", "Main banner image")} value={f.bannerUrl} onChange={(u) => set("bannerUrl", u)} />
                  </div>
                </>
              )}

              {!isStore && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={s("نوع المركبة", "Vehicle type")}>
                      <select className={inputCls} value={f.vehicle} onChange={(e) => set("vehicle", e.target.value)}>
                        <option value="">{s("— اختر —", "— select —")}</option>
                        <option>{s("موتوسيكل", "Motorcycle")}</option>
                        <option>{s("سيارة", "Car")}</option>
                        <option>{s("دراجة", "Bicycle")}</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ImageUpload label={s("بطاقة الهوية (إلزامية)", "ID card (required)")} value={f.idCardUrl} onChange={(u) => set("idCardUrl", u)} />
                    <ImageUpload label={s("رخصة القيادة (إلزامية)", "Driving license (required)")} value={f.licenseUrl} onChange={(u) => set("licenseUrl", u)} />
                  </div>
                </>
              )}

              <Btn type="submit" className="w-full" disabled={busy}>{busy ? <Spinner /> : isStore ? s("إرسال طلب الشراكة", "Submit partnership request") : s("إرسال طلب الانضمام", "Submit application")}</Btn>
              <p className="text-center text-[11px] leading-relaxed text-gray-400">
                {s("سيصلك رمز تفعيل على بريدك، ثم يُفعَّل الحساب بعد الموافقة النهائية من الإدارة.", "A verification code will be emailed to you; the account activates after final admin approval.")}
              </p>
            </form>
          )}

          {tab === "register" && !verified && (dev || info) && (
            <div className="mt-4 rounded-2xl border border-royal-150 bg-royal-50 p-4">
              {dev?.code && (
                <div className="mb-2 rounded-xl bg-gold-100 border border-gold-300 px-3 py-2 text-xs font-bold text-gold-700">
                  {s("للتجربة — رمزك هو", "Demo — your code is")}{" "}
                  <button className="font-black text-royal-900 underline" onClick={() => setCode(dev.code)}>{dev.code}</button>
                </div>
              )}
              <form onSubmit={onVerify} className="flex gap-2">
                <input dir="ltr" className={inputCls} placeholder={s("رمز التفعيل 6 أرقام", "6-digit verification code")} value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
                <Btn type="submit" variant="purple" disabled={busy}>{s("تفعيل", "Verify")}</Btn>
              </form>
            </div>
          )}

          {verified && (
            <div className="py-6 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <h3 className="mt-4 text-lg font-black text-royal-950">{s("تم إرسال طلبك بنجاح", "Application submitted")}</h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                {s("حسابك قيد المراجعة من فريق لقمة. ستصلك رسالة بريدية فور الموافقة، ويمكنك الدخول من تبويب تسجيل الدخول بعد التفعيل.", "Your account is under review by the Luqma team. You'll get an email once approved.")}
              </p>
              <div className="mt-5 flex justify-center gap-2">
                <Btn variant="outline" onClick={() => setTab("login")}>{s("تسجيل الدخول", "Go to login")}</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function LinkHome() {
    return (
      <button onClick={() => router.push("/")} className="flex items-center gap-2 text-white">
        <Logo size={36} withText={false} />
        <span className="text-sm font-black">{s("لقمة Luqma", "Luqma")}</span>
      </button>
    );
  }

  return shell();
}
