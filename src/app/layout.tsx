import "./globals.css";

export const metadata = {
  title: "لقمة Luqma — توصيل الطعام أينما كنت",
  description:
    "منصة لقمة luqma.store لتوصيل الطعام من أشهر مطاعم البحرين: اطلب، تابع طلبك، واستمتع.",
  icons: { icon: "/images/logo-mark.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Manrope:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
