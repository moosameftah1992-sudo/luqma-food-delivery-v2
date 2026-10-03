"use client";
import { useEffect, useState } from "react";

export type Lang = "ar" | "en";

export function useL() {
  const [lang, setLangState] = useState<Lang>("ar");
  useEffect(() => {
    const saved = localStorage.getItem("luqma_lang") as Lang | null;
    if (saved) setLangState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem("luqma_lang", lang);
  }, [lang]);
  const s = (ar: string, en: string) => (lang === "ar" ? ar : en);
  return { lang, setLang: setLangState, s, rtl: lang === "ar" };
}

export function fmtNum(v: unknown, suffix = "د.ب") {
  const n = Number(v || 0);
  return n.toLocaleString("en-BH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + suffix;
}

export function fmtDate(d: unknown, lang: Lang) {
  const dt = d instanceof Date ? d : new Date(String(d));
  return dt.toLocaleDateString(lang === "ar" ? "ar-BH" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
