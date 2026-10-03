"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useL, fmtNum } from "@/lib/i18n";

/* ---------------- Logo ---------------- */
export function Logo({ size = 42, light = true, withText = true }: { size?: number; light?: boolean; withText?: boolean }) {
  const { s } = useL();
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <img
        src="/images/logo-mark.png"
        alt="لقمة Luqma"
        width={size}
        height={size}
        className="rounded-xl shadow-md shadow-black/30"
        style={{ width: size, height: size }}
      />
      {withText && (
        <span className="leading-none">
          <span className={`block text-lg font-black ${light ? "text-white" : "text-royal-900"}`}>لقمة</span>
          <span className={`block text-[11px] font-bold tracking-wide ${light ? "text-gold-400" : "text-gold-600"}`}>Luqma</span>
        </span>
      )}
      <span className="sr-only">{s("لقمة", "Luqma")}</span>
    </span>
  );
}

/* ---------------- Language toggle ---------------- */
export function LangToggle({ dark = true }: { dark?: boolean }) {
  const { lang, setLang } = useL();
  return (
    <button
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      className={`text-xs font-bold rounded-full px-3 py-1.5 border transition ${
        dark ? "border-white/25 text-white/90 hover:bg-white/10" : "border-royal-200 text-royal-800 hover:bg-royal-50"
      }`}
      title="Language"
    >
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );
}

/* ---------------- Buttons / Badges / Fields ---------------- */
export function Btn({
  variant = "gold",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "gold" | "purple" | "ghost" | "danger" | "outline" }) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";
  const styles: Record<string, string> = {
    gold: "bg-gold-500 hover:bg-gold-400 text-royal-950 shadow-md shadow-gold-500/25",
    purple: "bg-royal-800 hover:bg-royal-700 text-white shadow-md shadow-royal-900/20",
    ghost: "bg-transparent hover:bg-royal-50 text-royal-800",
    danger: "bg-red-600 hover:bg-red-500 text-white",
    outline: "border border-royal-200 hover:border-royal-400 text-royal-800 bg-white",
  };
  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />;
}

export function Badge({ tone = "gray", children }: { tone?: "gold" | "green" | "red" | "purple" | "gray" | "blue"; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    gold: "bg-gold-100 text-gold-700 border-gold-300",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
    purple: "bg-royal-100 text-royal-700 border-royal-200",
    gray: "bg-gray-100 text-gray-600 border-gray-200",
    blue: "bg-sky-50 text-sky-700 border-sky-200",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-royal-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-royal-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-royal-500 focus:ring-2 focus:ring-royal-200 transition placeholder:text-gray-400";

/* ---------------- Modal ---------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-royal-950/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl fade-up`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-royal-100 bg-white/95 backdrop-blur px-5 py-3.5 rounded-t-3xl">
          <h3 className="text-base font-extrabold text-royal-900">{title}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-royal-50 text-royal-700 hover:bg-royal-100">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Image upload (dedicated Browse & Upload + preview) ---------------- */
export function ImageUpload({
  label,
  value,
  onChange,
  height = 120,
}: {
  label: string;
  value?: string | null;
  onChange: (url: string) => void;
  height?: number;
}) {
  const { s } = useL();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [urlMode, setUrlMode] = useState(false);
  const [urlVal, setUrlVal] = useState(value || "");

  useEffect(() => {
    if (value && !urlMode) setUrlVal(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleFile = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "fail");
      onChange(j.url);
      setUrlVal(j.url);
    } catch (e: any) {
      setErr(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="mb-1 block text-xs font-bold text-royal-800">{label}</span>
      <div className="flex items-start gap-3">
        <div
          className="relative shrink-0 overflow-hidden rounded-xl border border-dashed border-royal-300 bg-royal-50/60 grid place-items-center"
          style={{ width: 150, height }}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-[10px] text-royal-300 font-bold">
              {s("معاينة الصورة", "Image preview")}
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-royal-950/50">
              <span className="h-5 w-5 rounded-full border-2 border-gold-400 border-t-transparent spin-slow" />
            </span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
          <Btn variant="gold" type="button" className="w-full" onClick={() => ref.current?.click()} disabled={busy}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0L7 9m5-5l5 5M4 20h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {s("تصفح و رفع", "Browse & Upload")}
          </Btn>
          {!urlMode ? (
            <button type="button" className="text-[11px] font-bold text-royal-500 hover:text-royal-700" onClick={() => { setUrlMode(true); setUrlVal(value || ""); }}>
              {s("أو ضع رابط صورة", "Or paste image URL")}
            </button>
          ) : (
            <div className="flex gap-1.5">
              <input className={inputCls} dir="ltr" placeholder="https://…" value={urlVal} onChange={(e) => setUrlVal(e.target.value)} />
              <Btn type="button" variant="purple" onClick={() => urlVal && onChange(urlVal)}>OK</Btn>
            </div>
          )}
          {value && (
            <button type="button" className="text-[11px] font-bold text-red-500 hover:text-red-700" onClick={() => { onChange(""); setUrlVal(""); }}>
              {s("إزالة الصورة", "Remove image")}
            </button>
          )}
          {err && <span className="block text-[11px] font-bold text-red-600">{err}</span>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Audio alerts (WebAudio) ---------------- */
function beep(ctx: AudioContext, freq: number, t: number, dur: number, vol = 0.18) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function useAudioAlert(active: boolean, mode: "continuous" | "pulse", enabled = true) {
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!active || !enabled) return;
    let disposed = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let inner: ReturnType<typeof setTimeout> | null = null;

    const ensure = () => {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctxRef.current.state === "suspended") ctxRef.current.resume().catch(() => {});
      return ctxRef.current;
    };
    const kick = () => {
      const ctx = ensure();
      if (!ctx) return;
      const t = ctx.currentTime;
      if (mode === "continuous") {
        beep(ctx, 880, t, 0.18);
        beep(ctx, 660, t + 0.22, 0.18);
      } else {
        // 5 seconds of beeps (6 pulses)
        for (let i = 0; i < 6; i++) {
          beep(ctx, 950, t + i * 0.8, 0.25);
          beep(ctx, 700, t + i * 0.8 + 0.3, 0.25);
        }
      }
    };

    // require user gesture for autoplay: listen once on any click
    const onAny = () => kick();
    window.addEventListener("click", onAny, { once: true });

    if (mode === "continuous") {
      kick();
      timer = setInterval(kick, 1600);
    } else {
      kick();
      timer = setInterval(() => {
        kick();
      }, 60000);
    }
    void inner;
    return () => {
      disposed = true;
      window.removeEventListener("click", onAny);
      if (timer) clearInterval(timer);
      if (inner) clearTimeout(inner);
    };
    void disposed;
  }, [active, mode, enabled]);
}

/* ---------------- Status helpers ---------------- */
export const ORDER_STATUS: Record<string, { ar: string; en: string; tone: "gold" | "green" | "red" | "purple" | "gray" | "blue" }> = {
  pending: { ar: "بانتظار المطعم", en: "Pending store", tone: "gold" },
  accepted: { ar: "مقبول", en: "Accepted", tone: "blue" },
  preparing: { ar: "قيد التحضير", en: "Preparing", tone: "purple" },
  ready: { ar: "جاهز — بانتظار مندوب", en: "Ready — awaiting driver", tone: "gold" },
  out_for_delivery: { ar: "قيد التوصيل", en: "Out for delivery", tone: "blue" },
  delivered: { ar: "تم التسليم", en: "Delivered", tone: "green" },
  cancelled: { ar: "ملغي", en: "Cancelled", tone: "red" },
};

export function StatusBadge({ status }: { status: string }) {
  const { s } = useL();
  const m = ORDER_STATUS[status] || { ar: status, en: status, tone: "gray" as const };
  return <Badge tone={m.tone}>{s(m.ar, m.en)}</Badge>;
}

export function StoreStatusBadge({ status }: { status: string }) {
  const { s } = useL();
  if (status === "open") return <Badge tone="green">{s("مفتوح الآن", "Open now")}</Badge>;
  if (status === "busy") return <Badge tone="gold">{s("مشغول", "Busy")}</Badge>;
  return <Badge tone="red">{s("مغلق", "Closed")}</Badge>;
}

/* ---------------- Store card ---------------- */
export function StoreCard({ store, featured = false }: { store: any; featured?: boolean }) {
  const { s } = useL();
  return (
    <Link
      href={`/store/${store.id}`}
      className="group block overflow-hidden rounded-2xl border border-royal-100 bg-white shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition"
    >
      <div className="relative h-36 overflow-hidden bg-royal-100">
        {store.bannerUrl ? (
          <img src={store.bannerUrl} alt={store.nameAr} className="h-full w-full object-cover group-hover:scale-105 transition duration-500" />
        ) : (
          <div className="h-full w-full grid place-items-center bg-gradient-to-br from-royal-700 to-royal-900 text-4xl font-black text-gold-400">
            {store.nameAr?.[0] || "ل"}
          </div>
        )}
        <div className="absolute top-2 start-2 flex gap-1.5">
          {featured && <Badge tone="gold">{s("مميز", "Featured")}</Badge>}
          {store.discountPercent > 0 && <Badge tone="red">{s(`خصم ${store.discountPercent}%`, `-${store.discountPercent}%`)}</Badge>}
        </div>
        <div className="absolute bottom-2 end-2">
          <StoreStatusBadge status={store.status} />
        </div>
      </div>
      <div className="p-3.5">
        <h3 className="truncate text-sm font-extrabold text-royal-900">{store.nameAr}</h3>
        <p className="mt-0.5 truncate text-xs text-gray-500" dir="ltr" style={{ textAlign: "start" }}>{store.nameEn}</p>
        <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-royal-600">
          <span>{s("التوصيل", "Delivery")} {fmtNum(store.deliveryFee)}</span>
          <span className="rounded-lg bg-gold-100 px-2 py-1 text-gold-700 group-hover:bg-gold-500 group-hover:text-royal-950 transition">
            {s("عرض القائمة", "View menu")}
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ---------------- Header (customer) ---------------- */
export function Header({ user }: { user?: { name: string; bonus: string } | null }) {
  const { s } = useL();
  const [q, setQ] = useState("");
  return (
    <header className="no-print sticky top-0 z-40 bg-royal-950/95 backdrop-blur text-white shadow-lg shadow-royal-950/20">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link href="/"><Logo /></Link>
        <form
          className="hidden md:block flex-1 max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            location.href = "/" + (q ? `?q=${encodeURIComponent(q)}` : "");
          }}
        >
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={s("ابحث عن مطعم أو أكلة…", "Search restaurants…")}
              className="w-full rounded-full bg-white/10 border border-white/15 px-4 py-2 text-sm placeholder:text-white/40 outline-none focus:border-gold-400"
            />
            <span className="absolute end-3 top-1/2 -translate-y-1/2 text-white/40">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </span>
          </div>
        </form>
        <div className="ms-auto flex items-center gap-2">
          <LangToggle />
          {user ? (
            <Link
              href="/account"
              className="flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3.5 py-1.5 hover:bg-white/15 transition"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gold-500 text-royal-950 text-xs font-black">
                {user.name?.[0] || "ل"}
              </span>
              <span className="text-xs font-bold max-w-24 truncate">{user.name}</span>
              <span className="rounded-full bg-gold-500/15 border border-gold-500/30 px-2 py-0.5 text-[10px] font-black text-gold-300">
                {fmtNum(user.bonus)}
              </span>
            </Link>
          ) : (
            <>
              <Link href="/auth/register" className="hidden sm:block rounded-full border border-white/25 px-4 py-1.5 text-xs font-bold hover:bg-white/10 transition">
                {s("حساب جديد", "Sign up")}
              </Link>
              <Link href="/auth/login" className="rounded-full bg-gold-500 px-4 py-1.5 text-xs font-black text-royal-950 hover:bg-gold-400 shadow-md shadow-gold-500/30 transition">
                {s("تسجيل الدخول", "Log in")}
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="border-t border-white/10 bg-royal-900/60">
        <div className="mx-auto flex max-w-7xl items-center gap-4 overflow-x-auto px-4 py-1.5 text-[11px] font-bold text-white/70">
          <Link href="/partner/store" className="whitespace-nowrap hover:text-gold-400 transition">
            + {s("أضف مطعمك — انضم كشريك", "Add your restaurant — become a partner")}
          </Link>
          <span className="h-3 w-px bg-white/15" />
          <Link href="/partner/driver" className="whitespace-nowrap hover:text-gold-400 transition">
            + {s("انضم كمندوب توصيل", "Join as a delivery driver")}
          </Link>
          <span className="h-3 w-px bg-white/15 hidden sm:block" />
          <span className="hidden sm:block whitespace-nowrap">{s("توصيل سريع خلال 30 دقيقة في جميع مناطق البحرين", "Fast 30-min delivery across all of Bahrain")}</span>
        </div>
      </div>
    </header>
  );
}

/* ---------------- Footer (partner/driver logins discreetly here) + hidden admin dot ---------------- */
export function Footer() {
  const { s } = useL();
  return (
    <footer className="no-print mt-16 bg-royal-950 text-white/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 text-xs leading-relaxed text-white/50">
            {s("لقمة — منصة التوصيل الأولى في مملكة البحرين. مطاعم موثقة، مندوبون محترفون، وتوصيل سريع.", "Luqma — the leading delivery platform in Bahrain. Verified restaurants, professional drivers, fast delivery.")}
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-extrabold text-gold-400">{s("روابط سريعة", "Quick links")}</h4>
          <ul className="space-y-2 text-xs">
            <li><Link href="/" className="hover:text-gold-400">{s("الرئيسية", "Home")}</Link></li>
            <li><Link href="/auth/login" className="hover:text-gold-400">{s("تسجيل دخول العملاء", "Customer login")}</Link></li>
            <li><Link href="/partner/store" className="hover:text-gold-400">{s("دخول الشركاء (المطاعم)", "Store partners login")}</Link></li>
            <li><Link href="/partner/driver" className="hover:text-gold-400">{s("دخول مندوبي التوصيل", "Delivery drivers login")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-extrabold text-gold-400">{s("الدعم والمساندة", "Support")}</h4>
          <a href="https://wa.me/97336119511" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-500 transition">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.4 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2 0 .4-.1.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.4 1.8 2.2 1.3 1.1 2.3 1.4 2.6 1.6.3.1.5.1.6-.1l.7-.8c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.1.1.7-.1 1.2z"/></svg>
            +97336119511
          </a>
          <p className="mt-3 text-[11px] text-white/40" dir="ltr" style={{ textAlign: "start" }}>luqma.store — {new Date().getFullYear()}</p>
        </div>
      </div>
      {/* Hidden admin access dot — same color as the background, bottom-left */}
      <a
        href="/admin"
        aria-hidden="true"
        title="."
        className="fixed bottom-1 left-1 z-40 h-3 w-3 rounded-full bg-royal-950 opacity-60 hover:opacity-100 transition"
        style={{ backgroundColor: "var(--color-royal-950)" }}
      />
    </footer>
  );
}

/* ---------------- WhatsApp floating button ---------------- */
export function WhatsAppFab() {
  const { s } = useL();
  return (
    <a
      href="https://wa.me/97336119511"
      target="_blank"
      rel="noreferrer"
      title={s("الدعم عبر واتساب", "WhatsApp support")}
      className="no-print fixed bottom-5 start-5 z-40 grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-600/30 hover:scale-105 transition"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.4 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2 0 .4-.1.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.4 1.8 2.2 1.3 1.1 2.3 1.4 2.6 1.6.3.1.5.1.6-.1l.7-.8c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.1.1.7-.1 1.2z"/></svg>
    </a>
  );
}

/* ---------------- CSV export ---------------- */
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function Spinner({ light = false }: { light?: boolean }) {
  return <span className={`inline-block h-5 w-5 rounded-full border-2 border-t-transparent spin-slow ${light ? "border-white/60" : "border-royal-400"}`} />;
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-royal-200 bg-white/60 py-12 text-center text-sm font-bold text-royal-400">
      {text}
    </div>
  );
}
