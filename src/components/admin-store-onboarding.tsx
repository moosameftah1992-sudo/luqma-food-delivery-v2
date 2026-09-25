"use client";

import { useEffect, useState } from "react";
import { Plus, Store, ShieldCheck } from "lucide-react";
import { Modal, Btn, Field, inputCls } from "@/components/ui";
import { useLocale } from "@/components/locale-provider";

type Area = { id: number; nameAr: string; nameEn: string | null; governorateId: number };
export function AdminStoreOnboarding({ onCreated, toast }: { onCreated: () => void; toast: (m: string, t?: "ok" | "err") => void }) {
  const { tr, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) fetch("/api/admin/locations").then(r=>r.json()).then(d=>setAreas(d.areas || [])).catch(()=>{}); }, [open]);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true);
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch("/api/admin/stores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "تعذّر إنشاء المتجر", "err"); return; }
      setCredentials(data.credentials); onCreated(); toast(tr("تم إنشاء المتجر. سلّم بيانات الدخول للشريك بطريقة آمنة.", "Store created. Share credentials privately with the partner."));
    } catch { toast(tr("تعذّر الاتصال بالخادم", "Server unavailable"), "err"); }
    finally { setBusy(false); }
  };
  return <><button onClick={()=>{setOpen(true);setCredentials(null);}} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-[#ff7219] to-[#ffc32b] px-4 py-2.5 text-sm font-extrabold text-[#281044]"><Plus size={16}/>{tr("إضافة متجر", "Add restaurant")}</button>
    <Modal open={open} onClose={()=>setOpen(false)} title={tr("انضمام متجر جديد", "Onboard a restaurant")} wide>{credentials ? <div className="space-y-4 rounded-xl bg-[#f8f4ee] p-5 text-[#281044]"><ShieldCheck size={30} className="text-emerald-600"/><p className="font-bold">{tr("تم إنشاء حساب الشريك. انسخ البيانات وشاركها معه عبر قناة آمنة، ولن تظهر كلمة المرور مجدداً.", "Partner account created. Share these credentials securely; the password won't be displayed again.")}</p><p dir="ltr" className="break-all rounded-lg bg-white p-3 font-mono text-sm">{credentials.email}<br/>{credentials.password}</p><Btn onClick={()=>{setOpen(false);setCredentials(null);}}>{tr("تم", "Done")}</Btn></div> : <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><Field label={tr("اسم المتجر بالعربية", "Arabic restaurant name")}><input name="nameAr" required className={inputCls}/></Field><Field label={tr("الاسم بالإنجليزية", "English restaurant name")}><input name="nameEn" required className={inputCls} dir="ltr"/></Field><Field label={tr("البريد الإلكتروني", "Business email")}><input name="email" type="email" required className={inputCls} dir="ltr"/></Field><Field label={tr("هاتف المتجر", "Restaurant phone")}><input name="phone" type="tel" required className={inputCls} dir="ltr"/></Field><Field label={tr("نوع المطبخ", "Cuisine")}><input name="cuisine" required className={inputCls} placeholder={tr("مشاوي، مأكولات بحرية…", "Grills, seafood…")}/></Field><Field label={tr("المنطقة", "Area")}><select name="areaId" required className={inputCls}><option value="">{tr("اختر المنطقة", "Select area")}</option>{areas.map(a=><option key={a.id} value={a.id}>{locale === "en" ? a.nameEn || a.nameAr : a.nameAr}</option>)}</select></Field><Field label={tr("العنوان", "Address")}><input name="address" className={inputCls}/></Field><Field label={tr("رابط صورة المطعم", "Restaurant photo URL")}><input name="image" type="url" className={inputCls} dir="ltr" placeholder="https://..."/></Field><Field label={tr("وصف المطعم", "Restaurant description")} className="sm:col-span-2"><textarea name="description" rows={2} className={inputCls}/></Field><Field label={tr("كلمة مرور الشريك", "Partner password")} className="sm:col-span-2" hint={tr("12 حرفاً على الأقل. لا تُشاركها إلا مع مالك المتجر.", "At least 12 characters. Share only with the restaurant owner.")}><input name="password" type="password" minLength={12} required className={inputCls} dir="ltr"/></Field><div className="sm:col-span-2"><Btn type="submit" disabled={busy} className="w-full py-3">{busy ? tr("جارٍ الإنشاء…", "Creating…") : tr("إنشاء حساب المتجر", "Create restaurant account")}</Btn></div></form>}</Modal>
  </>;
}
