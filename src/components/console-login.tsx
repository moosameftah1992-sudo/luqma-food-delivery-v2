"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand";
import { Btn, Card, Field, inputCls } from "@/components/ui";
import { useToast } from "@/components/alert";
import type { Brand } from "@/lib/brand";

export function ConsoleLogin({
  role,
  brand,
  logoOverride,
  title,
  subtitle,
  useUsername,
  backHref,
  registerHref,
  setupPending,
  adminUsername = "admin",
}: {
  role: "store" | "admin";
  brand: Brand;
  logoOverride?: string;
  title: string;
  subtitle: string;
  useUsername?: boolean;
  backHref: string;
  registerHref?: string;
  setupPending?: boolean;
  adminUsername?: string;
}) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/auth/${role}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(fd.entries())),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "تعذر الدخول");
      return;
    }
    toast.show("أهلاً بك في لوحة لقمة");
    window.location.href = role === "store" ? "/store" : "/admin";
  };

  return (
    <div className="relative isolate min-h-screen bg-[#1B0733]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/store-front.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-gradient-to-l from-[#1B0733]/45 via-[#1B0733]/88 to-[#1B0733]" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo size={42} tone="light" override={logoOverride} />
          </Link>
          <Link href={backHref} className="text-sm font-bold text-white/60 hover:text-[#FDBA21]">
            العودة للتطبيق
          </Link>
        </div>

        <div className="flex flex-1 items-center py-10">
          <div className="grid w-full gap-10 lg:grid-cols-2">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.34em] text-[#FDBA21]">
                {title}
              </p>
              <h1 className="mt-4 font-display text-5xl font-extrabold leading-[0.95] text-white">
                {subtitle}
              </h1>
              <p className="mt-5 max-w-md text-white/70">
                {role === "admin"
                  ? "هذه لوحة التحكم كاملة الصلاحيات. سجّل الدخول باسم المستخدم أو ببريد إداري مرتبط بحسابك؛ بريد حساب العميل لا يمنح صلاحيات الإدارة."
                  : `الدخول بحساب مُنشأ من إدارة ${brand.appNameAr ?? "لقمة"} فقط — لا يوجد تسجيل ذاتي للمتاجر.`}
              </p>
              {role === "admin" && (
                <div className="mt-6 rounded-xl border border-[#FDBA21]/35 bg-[#FDBA21]/10 p-4 text-sm leading-7 text-white/85">
                  {setupPending ? (
                    <>
                      <p className="font-extrabold text-[#FDBA21]">لم يتم إعداد حساب المدير الأول بعد</p>
                      <p>
                        من إعدادات المشروع على Vercel أضف متغير البيئة
                        <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs" dir="ltr">LUQMA_ADMIN_PASSWORD</code>
                        بقيمة قوية من 12 حرفاً على الأقل، ويمكن إضافة
                        <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs" dir="ltr">LUQMA_ADMIN_EMAIL</code>
                        لبريدك الإداري. أعد النشر ثم سجّل الدخول.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-extrabold text-[#FDBA21]">للدخول كمدير كامل الصلاحيات</p>
                      <p>
                        اسم المستخدم الأولي:
                        <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs" dir="ltr">{adminUsername}</code>
                        ، أو البريد الإداري إذا كان مرتبطاً. كلمة المرور هي التي ضُبطت عند إنشاء الحساب، ولا تظهر للزوار.
                      </p>
                    </>
                  )}
                </div>
              )}

            </div>

            <Card className="h-fit p-6 sm:p-8">
              <form onSubmit={submit} className="space-y-4">
                <Field label={useUsername ? "اسم المستخدم أو البريد الإداري" : "البريد الإلكتروني"}>
                  <input
                    name={useUsername ? "username" : "email"}
                    type={useUsername ? "text" : "email"}
                    placeholder={useUsername ? `${adminUsername} أو بريدك الإداري` : "name@example.com"}
                    autoComplete="username"
                    required
                    className={inputCls}
                    dir="ltr"
                  />
                </Field>
                <Field label="كلمة المرور">
                  <input name="password" type="password" autoComplete="current-password" required className={inputCls} dir="ltr" />
                </Field>
                {err && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{err}</p>
                )}
                <Btn type="submit" disabled={busy} className="w-full py-3 text-base">
                  {busy ? "لحظات…" : "دخول"}
                </Btn>
                {registerHref && (
                  <p className="text-center text-sm text-[#6B5E7A]">
                    شريك جديد؟{" "}
                    <Link href={registerHref} className="font-bold text-[#B4520A]">
                      تواصل مع فريق التسجيل
                    </Link>
                  </p>
                )}
              </form>
              {toast.node}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
