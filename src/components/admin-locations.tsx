"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Plus, Pencil, Trash2, Globe2, Navigation, CheckCircle2, CircleOff, Search } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { Btn, Field, Modal, Spinner, darkInputCls, inputCls } from "@/components/ui";
import { fmtFils } from "@/lib/util";

type Gov = { id: number; nameAr: string; nameEn: string | null; active: boolean };
type Area = { id: number; governorateId: number; nameAr: string; nameEn: string | null; deliveryFeeFils: number; active: boolean };
type Draft = { kind: "governorate" | "area"; id?: number; nameAr: string; nameEn: string; governorateId: number; deliveryFeeFils: string; active: boolean };
const blank = (kind: Draft["kind"], governorateId = 0): Draft => ({ kind, nameAr: "", nameEn: "", governorateId, deliveryFeeFils: "1.500", active: true });

export function LocationsManager({ toast }: { toast: (message: string, tone?: "ok" | "err") => void }) {
  const { locale, tr } = useLocale();
  const [govs, setGovs] = useState<Gov[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/locations", { cache: "no-store" });
    if (!response.ok) { toast(tr("تعذّر تحميل المواقع", "Could not load locations"), "err"); return; }
    const result: { governorates: Gov[]; areas: Area[] } = await response.json();
    setGovs(result.governorates); setAreas(result.areas); setLoading(false);
    setSelected(previous => previous !== null && result.governorates.some(g => g.id === previous) ? previous : result.governorates[0]?.id ?? null);
  }, [toast, tr]);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => areas.filter(a => a.governorateId === selected && `${a.nameAr} ${a.nameEn || ""}`.toLowerCase().includes(query.toLowerCase())), [areas, selected, query]);
  const activeCount = areas.filter(a => a.active).length;
  const name = (v: { nameAr: string; nameEn: string | null }) => locale === "en" ? v.nameEn || v.nameAr : v.nameAr;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!draft || saving) return;
    setSaving(true);
    const body = { kind: draft.kind, nameAr: draft.nameAr.trim(), nameEn: draft.nameEn.trim(), active: draft.active, governorateId: draft.governorateId, deliveryFeeFils: Math.round(Number(draft.deliveryFeeFils) * 1000) };
    try {
      const response = await fetch(draft.id ? `/api/admin/locations/${draft.id}` : "/api/admin/locations", { method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذّر الحفظ");
      toast(tr("تم حفظ الموقع بنجاح", "Location saved successfully"));
      setDraft(null); await load();
      if (draft.kind === "governorate" && !draft.id && result.id) setSelected(result.id);
    } catch (error) { toast(error instanceof Error ? error.message : "تعذّر الحفظ", "err"); }
    finally { setSaving(false); }
  }
  async function remove(kind: Draft["kind"], id: number) {
    const subject = kind === "governorate" ? tr("المحافظة ومناطقها", "the governorate and its areas") : tr("المنطقة", "this area");
    if (!window.confirm(tr(`هل تريد حذف ${subject} نهائياً؟ قد يؤثر ذلك على الحسابات المرتبطة بها.`, `Delete ${subject} permanently? Linked accounts may be affected.`))) return;
    const response = await fetch(`/api/admin/locations/${id}${kind === "governorate" ? "?kind=governorate" : ""}`, { method: "DELETE" });
    if (!response.ok) { toast(tr("تعذّر الحذف", "Delete failed"), "err"); return; }
    toast(tr("تم الحذف", "Deleted")); await load();
  }
  if (loading) return <Spinner label={tr("جارٍ تحميل المواقع…", "Loading locations…")} />;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><span className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ffbd29]">{tr("تغطية التوصيل", "DELIVERY COVERAGE")}</span><h1 className="mt-1 font-display text-3xl font-extrabold text-white">{tr("المحافظات والمناطق", "Governorates & areas")}</h1><p className="mt-1 text-sm text-white/55">{tr("تحكّم بكل الأسماء، رسوم التوصيل، وحالة ظهور المناطق مباشرةً.", "Manage names, delivery fees, and visibility instantly.")}</p></div><button onClick={() => setDraft(blank("governorate"))} className="flex items-center gap-2 rounded-xl bg-gradient-to-l from-[#ff781a] to-[#ffc432] px-5 py-3 text-sm font-extrabold text-[#251039] shadow-lg shadow-[#ff8818]/15"><Plus size={16}/>{tr("محافظة جديدة", "New governorate")}</button></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><Globe2 size={20} className="text-[#ffc432]"/><p className="mt-3 text-3xl font-extrabold text-white">{govs.length}</p><p className="text-xs text-white/55">{tr("محافظات", "Governorates")}</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><MapPin size={20} className="text-[#ffc432]"/><p className="mt-3 text-3xl font-extrabold text-white">{areas.length}</p><p className="text-xs text-white/55">{tr("مناطق", "Areas")}</p></div><div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5 sm:col-span-1"><CheckCircle2 size={20} className="text-emerald-400"/><p className="mt-3 text-3xl font-extrabold text-white">{activeCount}</p><p className="text-xs text-white/55">{tr("منطقة فعّالة", "Active areas")}</p></div></div>
    <div className="grid gap-5 lg:grid-cols-[290px_1fr]"><aside className="self-start rounded-2xl border border-white/10 bg-[#291147] p-3"><p className="px-3 py-3 text-xs font-extrabold text-[#ffc432]">{tr("المحافظات", "GOVERNORATES")}</p><div className="space-y-1">{govs.map(g => <div key={g.id} className={`group flex items-center gap-1 rounded-xl transition ${selected === g.id ? "bg-[#ffc432] text-[#291147]" : "text-white/70 hover:bg-white/10"}`}><button onClick={()=>setSelected(g.id)} className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-3 text-start text-sm font-bold"><span className="truncate">{name(g)}</span><span className="text-[11px] opacity-65">{areas.filter(a=>a.governorateId===g.id).length}</span></button><button aria-label={tr("تعديل", "Edit")} onClick={()=>setDraft({ ...blank("governorate"), id:g.id, nameAr:g.nameAr, nameEn:g.nameEn || "", active:g.active })} className="rounded-lg p-2 hover:bg-black/10"><Pencil size={14}/></button><button aria-label={tr("حذف", "Delete")} onClick={()=>void remove("governorate",g.id)} className="me-1 rounded-lg p-2 hover:bg-rose-600/20 hover:text-rose-500"><Trash2 size={14}/></button></div>)}</div></aside>
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#291147]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5"><div><p className="font-display text-xl font-extrabold text-white">{name(govs.find(g=>g.id===selected) || {nameAr:"—",nameEn:"—"})}</p><p className="text-xs text-white/50">{tr("أسماء المناطق ورسوم التوصيل والحالة", "Area names, delivery fees & status")}</p></div><button disabled={!selected} onClick={()=>setDraft(blank("area",selected || 0))} className="flex items-center gap-1 rounded-lg border border-[#ffc432]/45 px-3 py-2 text-xs font-bold text-[#ffc432] hover:bg-[#ffc432]/10 disabled:opacity-50"><Plus size={14}/>{tr("إضافة منطقة", "Add area")}</button></div><div className="p-4"><label className="relative block"><Search size={17} className="absolute start-3 top-3 text-white/45"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={tr("ابحث عن منطقة…", "Search areas…")} className={`${darkInputCls} ps-10`}/></label><div className="mt-3 divide-y divide-white/8">{visible.map(a=><div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/7 text-[#ffc432]"><Navigation size={18}/></span><div><p className="text-sm font-bold text-white">{name(a)}</p><p dir="auto" className="text-xs text-white/45">{locale === "en" ? a.nameAr : a.nameEn || "—"}</p></div></div><div className="flex items-center gap-3"><span className="text-sm font-bold text-[#ffc432]">{fmtFils(a.deliveryFeeFils)}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${a.active ? "bg-emerald-400/10 text-emerald-300" : "bg-white/10 text-white/50"}`}>{a.active ? tr("فعالة", "Active") : tr("مخفية", "Hidden")}</span><button aria-label={tr("تعديل", "Edit")} onClick={()=>setDraft({kind:"area",id:a.id,nameAr:a.nameAr,nameEn:a.nameEn || "",governorateId:a.governorateId,deliveryFeeFils:(a.deliveryFeeFils/1000).toFixed(3),active:a.active})} className="rounded-lg p-2 text-white/65 hover:bg-white/10 hover:text-white"><Pencil size={16}/></button><button aria-label={tr("حذف", "Delete")} onClick={()=>void remove("area",a.id)} className="rounded-lg p-2 text-rose-300 hover:bg-rose-600/20"><Trash2 size={16}/></button></div></div>)}{visible.length === 0 && <div className="py-16 text-center text-sm text-white/40">{tr("لا توجد مناطق هنا بعد", "No areas here yet")}</div>}</div></div></section></div>
    <Modal open={!!draft} onClose={()=>setDraft(null)} title={draft?.id ? tr("تعديل الموقع", "Edit location") : tr("موقع جديد", "New location")}>
      {draft && <form onSubmit={save} className="space-y-4"><Field label={tr("الاسم بالعربية", "Arabic name")}><input required className={inputCls} value={draft.nameAr} onChange={e=>setDraft({...draft,nameAr:e.target.value})} dir="rtl" /></Field><Field label={tr("الاسم بالإنجليزية", "English name")}><input required className={inputCls} value={draft.nameEn} onChange={e=>setDraft({...draft,nameEn:e.target.value})} dir="ltr" /></Field>{draft.kind === "area" && <><Field label={tr("المحافظة", "Governorate")}><select className={inputCls} value={draft.governorateId} onChange={e=>setDraft({...draft,governorateId:Number(e.target.value)})}>{govs.map(g=><option key={g.id} value={g.id}>{name(g)}</option>)}</select></Field><Field label={tr("رسوم التوصيل (د.ب)", "Delivery fee (BHD)")}><input type="number" min="0" max="30" step="0.001" required className={inputCls} dir="ltr" value={draft.deliveryFeeFils} onChange={e=>setDraft({...draft,deliveryFeeFils:e.target.value})}/></Field></>}<label className="flex items-center gap-3 rounded-xl bg-[#f8f4ef] p-3 text-sm font-bold text-[#291147]"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})} className="accent-[#281044]"/>{tr("ظاهر للعملاء ومتاح للاختيار", "Visible and available to customers")}</label><Btn type="submit" className="w-full py-3" disabled={saving}>{saving ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ التغييرات", "Save changes")}</Btn></form>}
    </Modal>
  </div>;
}
