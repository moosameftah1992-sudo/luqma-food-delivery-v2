import type { Metadata } from "next";
import { Baloo_Bhaijaan_2, Tajawal } from "next/font/google";
import { cookies } from "next/headers";
import { LocaleProvider } from "@/components/locale-provider";
import type { ReactNode } from "react";
import "./globals.css";

const baloo = Baloo_Bhaijaan_2({ subsets: ["arabic"], weight: ["400", "600", "700", "800"], variable: "--font-baloo", display: "swap" });
const tajawal = Tajawal({ subsets: ["arabic"], weight: ["300", "400", "500", "700", "800"], variable: "--font-tajawal", display: "swap" });

export const metadata: Metadata = {
  title: "لقمة | Luqma Food Delivery Bahrain",
  description: "لقمة — اطلب من مطاعم البحرين المفضلة لديك. Luqma — the flavors of Bahrain delivered to you.",
  icons: { icon: "/brand/luqma-mark.svg" },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = (await cookies()).get("luqma_locale")?.value === "en" ? "en" : "ar";
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`${baloo.variable} ${tajawal.variable}`}>
      <body className="min-h-screen bg-paper font-ui text-body antialiased"><LocaleProvider initial={locale}>{children}</LocaleProvider></body>
    </html>
  );
}
