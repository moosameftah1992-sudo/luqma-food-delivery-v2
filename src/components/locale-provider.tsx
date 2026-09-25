"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translate, type Locale } from "@/lib/i18n";

const LocaleContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void; tr: (ar: string, en?: string) => string }>({ locale: "ar", setLocale: () => {}, tr: (ar) => ar });

export function LocaleProvider({ initial, children }: { initial: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial);
  const setLocale = (next: Locale) => {
    document.cookie = `luqma_locale=${next};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    setLocaleState(next);
    window.location.reload(); // reload server-rendered location names and CMS copy
  };
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, tr: (ar: string, en?: string) => locale === "en" ? en || translate(ar, "en") : ar }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() { return useContext(LocaleContext); }

export function LanguageSwitch({ dark = true }: { dark?: boolean }) {
  const { locale, setLocale } = useLocale();
  return <button type="button" aria-label="Switch language / تغيير اللغة" onClick={() => setLocale(locale === "ar" ? "en" : "ar")} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-extrabold transition ${dark ? "border-white/25 text-white/85 hover:border-[#FFC22D] hover:text-[#FFC22D]" : "border-[#281044]/20 text-[#281044] hover:bg-[#281044]/10"}`}>{locale === "ar" ? "EN" : "عربي"}</button>;
}
