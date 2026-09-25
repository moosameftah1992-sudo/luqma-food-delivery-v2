"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { cn, fmtFils } from "@/lib/util";
import { Logo, LogoMark } from "@/components/brand";
import { LanguageSwitch } from "@/components/locale-provider";

export { LogoMark };

export function Btn({
  children,
  variant = "gold",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "gold" | "ink" | "ghost" | "danger" | "outline" | "outlineLight";
}) {
  const styles: Record<string, string> = {
    gold: "bg-gradient-to-l from-[#FF6A00] to-[#FDBA21] text-[#2A0A4A] hover:brightness-105 shadow-[0_8px_24px_-10px_rgba(253,186,33,0.9)]",
    ink: "bg-[#2A0A4A] text-white hover:bg-[#3B1266]",
    ghost: "bg-transparent text-[#2A0A4A] hover:bg-[#2A0A4A]/8",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    outline: "border border-[#2A0A4A]/25 text-[#2A0A4A] hover:border-[#2A0A4A] hover:bg-[#2A0A4A]/5",
    outlineLight: "border border-[#FDBA21]/45 text-[#FDBA21] hover:bg-[#FDBA21] hover:text-[#2A0A4A]",
  };
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45",
        styles[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B5E7A]">
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-[#6B5E7A]">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-[#2A0A4A]/15 bg-white px-3.5 py-2.5 text-sm text-[#2B2433] outline-none transition placeholder:text-[#6B5E7A]/60 focus:border-[#FDBA21] focus:ring-4 focus:ring-[#FDBA21]/20";

export const darkInputCls =
  "w-full rounded-xl border border-white/15 bg-[#1B0733] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#FDBA21] focus:ring-4 focus:ring-[#FDBA21]/15";

export function Card({
  children,
  className,
  dark,
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border",
        dark
          ? "border-white/10 bg-[#2A0A4A] text-white shadow-[0_18px_50px_-30px_rgba(0,0,0,0.9)]"
          : "border-[#2A0A4A]/8 bg-white text-[#2B2433] shadow-[0_18px_50px_-38px_rgba(42,10,74,0.55)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#FDBA21]">
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#1B0733]/70 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        className={cn(
          "modal-in max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#2A0A4A]/10 bg-white px-5 py-4">
          <h3 className="font-display text-lg font-extrabold text-[#2A0A4A]">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[#6B5E7A] transition hover:bg-[#2A0A4A]/8 hover:text-[#2A0A4A]"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  dark,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  dark?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        dark
          ? "border-white/10 bg-[#2A0A4A]"
          : "border-[#2A0A4A]/8 bg-white",
      )}
    >
      <p
        className={cn(
          "text-[11px] font-bold uppercase tracking-[0.18em]",
          dark ? "text-white/55" : "text-[#6B5E7A]",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-display text-2xl font-extrabold tabular-nums",
          accent ? "text-[#FF7A00]" : dark ? "text-white" : "text-[#2A0A4A]",
        )}
      >
        {value}
      </p>
      {sub && (
        <p className={cn("mt-1 text-xs", dark ? "text-white/50" : "text-[#6B5E7A]")}>{sub}</p>
      )}
    </div>
  );
}

export function Price({ fils, className }: { fils: number; className?: string }) {
  return (
    <span className={cn("tabular-nums font-bold", className)} dir="rtl">
      {fmtFils(fils)}
    </span>
  );
}

export function Empty({ text, dark }: { text: string; dark?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed p-10 text-center text-sm",
        dark
          ? "border-white/15 text-white/55"
          : "border-[#2A0A4A]/15 text-[#6B5E7A]",
      )}
    >
      {text}
    </div>
  );
}

export function Spinner({ label = "جاري التحميل…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-10 text-sm text-[#6B5E7A]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#FDBA21] border-t-transparent" />
      {label}
    </div>
  );
}

/** Fixed brass-on-aubergine icon rail used by the three operator consoles. */
export function ConsoleShell({
  brand,
  logoOverride,
  nav,
  active,
  onNav,
  user,
  onLogout,
  right,
  children,
}: {
  brand: { appNameAr?: string; supportWhatsapp?: string };
  logoOverride?: string;
  nav: { key: string; label: string; icon: ReactNode }[];
  active: string;
  onNav: (k: string) => void;
  user: string;
  onLogout: () => void;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#1B0733] text-white" dir="rtl">
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-[86px] flex-col items-center gap-1 border-l border-white/10 bg-[#2A0A4A] py-5 lg:flex">
        <Link href="/" className="mb-4">
          <LogoMark size={40} />
        </Link>
        {nav.map((n) => (
          <button
            key={n.key}
            onClick={() => onNav(n.key)}
            title={n.label}
            className={cn(
              "group flex w-[70px] flex-col items-center gap-1 rounded-xl px-1 py-3 text-[10px] font-bold transition",
              active === n.key
                ? "bg-gradient-to-b from-[#FDBA21] to-[#FF7A00] text-[#2A0A4A]"
                : "text-white/55 hover:bg-white/8 hover:text-white",
            )}
          >
            <span className="text-lg">{n.icon}</span>
            <span className="text-center leading-tight">{n.label}</span>
          </button>
        ))}
        <div className="mt-auto flex flex-col items-center gap-2">
          <span className="h-8 w-px bg-white/10" />
          <button
            onClick={onLogout}
            className="rounded-lg px-2 py-2 text-[10px] font-bold text-white/50 transition hover:text-[#FDBA21]"
          >
            خروج
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#2A0A4A]/95 backdrop-blur lg:mr-[86px]">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <Logo size={34} tone="light" override={logoOverride} compact />
          <div className="mx-2 hidden h-8 w-px bg-white/15 sm:block" />
          <div className="hidden min-w-0 sm:block">
            <p className="truncate font-display text-sm font-extrabold text-white">{user}</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#FDBA21]">
              {brand.appNameAr} · لوحة التحكم
            </p>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2"><LanguageSwitch />{right}</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
          {nav.map((n) => (
            <button
              key={n.key}
              onClick={() => onNav(n.key)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                active === n.key
                  ? "bg-[#FDBA21] text-[#2A0A4A]"
                  : "bg-white/8 text-white/65",
              )}
            >
              {n.label}
            </button>
          ))}
          <button
            onClick={onLogout}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-white/45"
          >
            خروج
          </button>
        </nav>
      </header>

      <main className="lg:mr-[86px]">{children}</main>
    </div>
  );
}

export function SectionTitle({
  children,
  sub,
}: {
  children: ReactNode;
  sub?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <Label>—</Label>
        <h2 className="font-display text-2xl font-extrabold text-white">{children}</h2>
        {sub && <p className="mt-1 text-sm text-white/55">{sub}</p>}
      </div>
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
  dark,
  className,
}: {
  tabs: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 inline-flex flex-wrap gap-1 rounded-xl p-1",
        dark ? "bg-white/8" : "bg-[#2A0A4A]/6",
        className,
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-bold transition",
            value === t.key
              ? "bg-[#FDBA21] text-[#2A0A4A]"
              : dark
                ? "text-white/60 hover:text-white"
                : "text-[#6B5E7A] hover:text-[#2A0A4A]",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
