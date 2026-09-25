import { getDb } from "@/lib/sdb";
import * as t from "@/db/schema";
import { eq } from "drizzle-orm";
import { brandFrom, whatsappLink } from "@/lib/brand";
import Link from "next/link";
import { Logo } from "@/components/brand";

export const dynamic = "force-dynamic";

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();
  const brand = brandFrom(await db.select().from(t.settings));
  const [page] = await db.select().from(t.cmsPages).where(eq(t.cmsPages.slug, slug));

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-[#2A0A4A]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/">
            <Logo size={38} tone="light" override={brand.logoUrl || undefined} />
          </Link>
          <Link href="/" className="text-sm font-bold text-white/60 hover:text-[#FDBA21]">
            العودة للمطاعم
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl font-extrabold text-[#2A0A4A]">
          {page?.titleAr ?? "صفحة غير موجودة"}
        </h1>
        <div className="mt-6 space-y-4 text-base leading-loose text-[#2B2433]/85">
          {(page?.bodyAr ?? "لم يتم نشر محتوى لهذه الصفحة بعد من لوحة التحكم.").split("\n\n").map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <a
          href={whatsappLink(brand)}
          target="_blank"
          rel="noreferrer"
          className="mt-10 inline-flex items-center gap-2 rounded-xl bg-[#2FA36B] px-5 py-3 text-sm font-bold text-white"
        >
          ✆ {brand.supportLabel}
        </a>
      </article>
    </div>
  );
}
