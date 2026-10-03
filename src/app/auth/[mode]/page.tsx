"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Btn, Field, inputCls, Logo, LangToggle, Spinner } from "@/components/ui";
import { useL } from "@/lib/i18n";

type Dev = { code?: string; token?: string } | null;

function AuthInner() {
  const { mode } = useParams<{ mode: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const { s } = useL();
  const next = params.get("next") || "/";

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [dev, setDev] = useState<Dev>(null);
  const [f, setF] = useState({
    name: "", email: "", phone: "", password: "", addressLine: "", addressLabel: "",
    code: "", token: params.get("token") || "", newPassword: "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const post = async (body: any) => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.error) {
        setErr(j.error);
        return j;
      }
      return j;
    } finally {
      setBusy(false);
    }
  };

  // auto-verify when arriving with token
  useEffect(() => {
    if (mode === "verify" && params.get("token")) {
      post({ action: "verify", token: params.get("token") });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [mode, params]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const j = await post({ action: "login", role: "customer", identifier: f.email, password: f.password });
    if (!j) return;
    if (j.needVerify) {
      setDev(j.dev);
      setInfo(s("الحساب غير مفعّل بعد — أرسلنا رمز تفعيل إلى بريدك", "Account not verified — we emailed you a code"));
      router.push("/auth/verify");
      return;
    }
    if (j.ok) {
      router.push(next);
      return;
    }
  };

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password.length < 8) {
      setErr(s("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "Password must be at least 8 characters"));
      return;
    }
    if (!f.addressLine.trim()) {
      setErr(s("أدخل عنوانك الافتراضي لإتمام التسجيل", "Enter your default address to finish"));
      return;
    }
    const j = await post({ action: "register", role: "customer", ...f });
    if (!j) return;
    if (j.needVerify) {
      setDev(j.dev);
      setInfo(s("تم إنشاء حسابك! أرسلنا رمز التفعيل إلى بريدك الإلكتروني", "Account created! A verification code was emailed to you"));
      router.push("/auth/verify");
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const j = await post({ action: "verify", email: f.email || undefined, code: f.code || undefined, token: f.token || undefined });
    if (!j) return;
    setInfo("");
    router.push("/auth/login");
  };

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const j = await post({ action: "forgot", email: f.email });
    if (!j) return;
    setDev(j.dev);
    setInfo(s("إذا كان البريد مسجلاً لدينا فقد أرسلنا لك رابط إعادة التعيين", "If the email is registered, a reset link was sent"));
    router.push("/auth/reset");
  };

  const onReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.newPassword.length < 8) {
      setErr(s("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "Password must be at least 8 characters"));
      return;
    }
    const j = await post({ action: "reset", token: f.token, email: f.email || undefined, password: f.newPassword });
    if (!j) return;
    setErr("");
    setInfo(s("تم تغيير كلمة المرور بنجاح — سجّل دخولك", "Password updated — please log in"));
    router.push("/auth/login");
  };

  const onResend = async () => {
    const j = await post({ action: "resend", role: "customer", email: f.email });
    if (!j) return;
    setDev(j.dev);
    setInfo(s("تم إرسال رمز جديد", "A new code was sent"));
  };

  const card = (title: string, body: React.ReactNode) => (
    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl fade-up">
      <h1 className="mb-5 text-xl font-black text-royal-950">{title}</h1>
      {err && <div className="mb-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-600">{err}</div>}
      {info && <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700">{info}</div>}
      {dev?.code && (
        <div className="mb-3 rounded-xl bg-gold-100 border border-gold-300 px-3 py-2 text-xs font-bold text-gold-700">
          {s("للتجربة (البريد غير متاح حالياً) — رمزك:", "Demo mode (email unavailable) — your code:")}{" "}
          <button className="font-black text-royal-900 underline" onClick={() => set("code", dev!.code || "")}>{dev.code}</button>
          {dev.token && " / "}
          {dev.token && <button className="font-black text-royal-900 underline" onClick={() => set("token", dev!.token || "")}>{dev.token}</button>}
        </div>
      )}
      {body}
    </div>
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-royal-950 p-4">
      <div className="absolute inset-0 opacity-50" style={{ background: "radial-gradient(800px 400px at 80% 10%, rgba(247,181,0,0.18), transparent 60%), radial-gradient(700px 400px at 15% 90%, rgba(109,63,160,0.45), transparent 60%)" }} />
      <div className="absolute top-4 end-4"><LangToggle /></div>
      <div className="relative flex w-full max-w-md flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo size={72} withText={false} />
          <h2 className="text-lg font-black text-white">{s("منصة لقمة لتوصيل الطعام", "Luqma food delivery platform")}</h2>
          <p className="text-xs text-white/50">{s("دخول مستقل للعملاء", "Standalone customer access")}</p>
        </div>

        {mode === "login" &&
          card(s("تسجيل دخول", "Log in"), (
            <form onSubmit={onLogin} className="space-y-3">
              <Field label={s("البريد الإلكتروني", "Email")}>
                <input dir="ltr" className={inputCls} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" required />
              </Field>
              <Field label={s("كلمة المرور", "Password")}>
                <input dir="ltr" className={inputCls} type="password" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="••••••••" required />
              </Field>
              <div className="text-end">
                <button type="button" onClick={() => router.push("/auth/forgot")} className="text-[11px] font-bold text-royal-500 hover:text-royal-700">
                  {s("نسيت كلمة المرور؟", "Forgot password?")}
                </button>
              </div>
              <Btn type="submit" className="w-full" disabled={busy}>{busy ? <Spinner /> : s("دخول", "Sign in")}</Btn>
              <p className="text-center text-xs text-gray-500">
                {s("ليس لديك حساب؟", "No account yet?")}{" "}
                <button type="button" className="font-black text-gold-600 hover:underline" onClick={() => router.push("/auth/register")}>{s("أنشئ حساباً", "Sign up")}</button>
              </p>
            </form>
          ))}

        {mode === "register" &&
          card(s("إنشاء حساب جديد", "Create account"), (
            <form onSubmit={onRegister} className="space-y-3">
              <Field label={s("الاسم الكامل", "Full name")}>
                <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={s("البريد الإلكتروني", "Email")}>
                  <input dir="ltr" className={inputCls} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} required />
                </Field>
                <Field label={s("رقم الهاتف", "Phone")}>
                  <input dir="ltr" className={inputCls} value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+973 …" />
                </Field>
              </div>
              <Field label={s("كلمة المرور (8 أحرف على الأقل)", "Password (min 8 chars)")}>
                <input dir="ltr" className={inputCls} type="password" value={f.password} onChange={(e) => set("password", e.target.value)} minLength={8} required />
              </Field>
              <Field label={s("عنوانك الافتراضي (يمكن إضافة عناوين أخرى لاحقاً)", "Default address (add more later)")}>
                <input className={inputCls} value={f.addressLine} onChange={(e) => set("addressLine", e.target.value)} placeholder={s("الشارع، البناية، أقرب معلم…", "Street, building, landmark…")} required />
              </Field>
              <Btn type="submit" className="w-full" disabled={busy}>{busy ? <Spinner /> : s("تسجيل وحسابي", "Create account")}</Btn>
              <p className="text-center text-xs text-gray-500">
                {s("لديك حساب بالفعل؟", "Already registered?")}{" "}
                <button type="button" className="font-black text-gold-600 hover:underline" onClick={() => router.push("/auth/login")}>{s("سجّل دخولك", "Log in")}</button>
              </p>
            </form>
          ))}

        {mode === "verify" &&
          card(s("تفعيل الحساب", "Verify account"), (
            <form onSubmit={onVerify} className="space-y-3">
              <p className="text-xs leading-relaxed text-gray-500">
                {s("أدخل الرمز المكون من 6 أرقام الذي أرسلناه إلى بريدك الإلكتروني.", "Enter the 6-digit code we emailed you.")}
              </p>
              <Field label={s("البريد الإلكتروني", "Email")}>
                <input dir="ltr" className={inputCls} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" required />
              </Field>
              <Field label={s("رمز التفعيل", "Verification code")}>
                <input dir="ltr" className={`${inputCls} text-center text-xl tracking-[0.5em] font-black`} value={f.code} onChange={(e) => set("code", e.target.value)} maxLength={6} required />
              </Field>
              {f.token && <input type="hidden" value={f.token} />}
              <Btn type="submit" className="w-full" disabled={busy}>{busy ? <Spinner /> : s("تأكيد التفعيل", "Verify")}</Btn>
              <button type="button" onClick={onResend} className="w-full text-center text-[11px] font-bold text-royal-500 hover:text-royal-700">
                {s("إعادة إرسال الرمز", "Resend code")}
              </button>
            </form>
          ))}

        {mode === "forgot" &&
          card(s("استعادة كلمة المرور", "Reset password"), (
            <form onSubmit={onForgot} className="space-y-3">
              <p className="text-xs text-gray-500">{s("أدخل بريدك المسجل وسنرسل لك رابط إعادة التعيين — دون الحاجة لأي تدخل إداري.", "Enter your registered email and we'll email a reset link — no admin needed.")}</p>
              <Field label={s("البريد الإلكتروني", "Email")}>
                <input dir="ltr" className={inputCls} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} required />
              </Field>
              <Btn type="submit" className="w-full" disabled={busy}>{busy ? <Spinner /> : s("إرسال رابط الاستعادة", "Send reset link")}</Btn>
              <button type="button" onClick={() => router.push("/auth/login")} className="w-full text-center text-[11px] font-bold text-royal-500">
                {s("العودة لتسجيل الدخول", "Back to login")}
              </button>
            </form>
          ))}

        {mode === "reset" &&
          card(s("كلمة مرور جديدة", "New password"), (
            <form onSubmit={onReset} className="space-y-3">
              <p className="text-xs text-gray-500">{s("استخدم رمز الاستعادة الذي وصلك بالبريد.", "Use the reset token you received by email.")}</p>
              <Field label={s("رمز الاستعادة (من رابط البريد)", "Reset token (from email link)")}>
                <input dir="ltr" className={inputCls} value={f.token} onChange={(e) => set("token", e.target.value)} required />
              </Field>
              <Field label={s("كلمة المرور الجديدة (8 أحرف على الأقل)", "New password (min 8 chars)")}>
                <input dir="ltr" className={inputCls} type="password" value={f.newPassword} onChange={(e) => set("newPassword", e.target.value)} minLength={8} required />
              </Field>
              <Btn type="submit" className="w-full" disabled={busy}>{busy ? <Spinner /> : s("تحديث كلمة المرور", "Update password")}</Btn>
            </form>
          ))}

        <button onClick={() => router.push("/")} className="text-xs font-bold text-white/50 hover:text-white">
          {s("← العودة للرئيسية", "← Back to home")}
        </button>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-royal-950"><Spinner light /></div>}>
      <AuthInner />
    </Suspense>
  );
}
