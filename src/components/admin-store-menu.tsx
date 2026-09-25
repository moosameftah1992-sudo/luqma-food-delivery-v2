"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgePercent, CirclePlus, Pencil, Trash2, UtensilsCrossed, Layers3, PackageCheck, Save } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { Btn, Modal, Spinner, inputCls } from "@/components/ui";
import { fmtFils } from "@/lib/util";

type Category = { id: number; storeId: number; nameAr: string; nameEn: string | null; sortOrder: number };
type ItemOption = { id: number; nameAr: string; priceFils: number };
type Item = { id: number; categoryId: number | null; nameAr: string; nameEn: string | null; description: string; descriptionEn: string | null; image: string; priceFils: number; discountPct: number; available: boolean; sizes: ItemOption[]; addons: ItemOption[] };
type OptionDraft = { nameAr: string; price: string };
type ItemDraft = { id?: number; categoryId: string; nameAr: string; nameEn: string; description: string; descriptionEn: string; image: string; price: string; discountPct: string; available: boolean; sizes: OptionDraft[]; addons: OptionDraft[] };
const newDraft = (): ItemDraft => ({ categoryId: "", nameAr: "", nameEn: "", description: "", descriptionEn: "", image: "", price: "", discountPct: "0", available: true, sizes: [], addons: [] });
const asDraft = (item: Item): ItemDraft => ({ id: item.id, categoryId: String(item.categoryId ?? ""), nameAr: item.nameAr, nameEn: item.nameEn || "", description: item.description, descriptionEn: item.descriptionEn || "", image: item.image, price: (item.priceFils / 1000).toFixed(3), discountPct: String(item.discountPct), available: item.available, sizes: item.sizes.map((size) => ({ nameAr: size.nameAr, price: (size.priceFils / 1000).toFixed(3) })), addons: item.addons.map((addon) => ({ nameAr: addon.nameAr, price: (addon.priceFils / 1000).toFixed(3) })) });
const parsePrice = (value: string) => /^\d{1,7}(?:\.\d{1,3})?$/.test(value) ? Math.round(Number(value) * 1000) : NaN;

export function AdminStoreMenu({ storeId, toast }: { storeId: number; toast: (message: string, tone?: "ok" | "err") => void }) {
  const { locale, tr } = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<{ id?: number; nameAr: string; nameEn: string } | null>(null);
  const [bulkDiscount, setBulkDiscount] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const name = (item: { nameAr: string; nameEn?: string | null }) => locale === "en" ? item.nameEn || item.nameAr : item.nameAr;

  const reload = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/stores/${storeId}/menu`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تحميل القائمة");
      setCategories(payload.categories); setItems(payload.items);
    } catch (error) { toast(error instanceof Error ? error.message : "تعذر الاتصال", "err"); }
    finally { setLoading(false); }
  }, [storeId, toast]);
  useEffect(() => { void reload(); }, [reload]);
  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!categoryDraft || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/stores/${storeId}/menu`, { method: categoryDraft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "category", ...categoryDraft }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر حفظ القسم");
      setCategoryDraft(null); toast(tr("حُفظ القسم", "Category saved")); await reload();
    } catch (error) { toast(error instanceof Error ? error.message : "تعذر الاتصال", "err"); }
    finally { setBusy(false); }
  }
  async function saveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!draft || busy) return;
    const priceFils = parsePrice(draft.price);
    const discountPct = Number(draft.discountPct);
    if (!Number.isSafeInteger(priceFils) || priceFils > 10_000_000 || !Number.isInteger(discountPct) || discountPct < 0 || discountPct > 90) return toast(tr("تحقق من السعر أو نسبة الخصم", "Check price and discount percentage"), "err");
    const sizes = draft.sizes.map((option) => ({ nameAr: option.nameAr.trim(), priceFils: parsePrice(option.price) }));
    const addons = draft.addons.map((option) => ({ nameAr: option.nameAr.trim(), priceFils: parsePrice(option.price) }));
    if ([...sizes, ...addons].some((option) => !option.nameAr || !Number.isSafeInteger(option.priceFils) || option.priceFils > 10_000_000)) return toast(tr("تحقق من أسعار وأسماء الأحجام والإضافات", "Check size and add-on names and prices"), "err");
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/stores/${storeId}/menu`, { method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "item", id: draft.id, categoryId: draft.categoryId || null, nameAr: draft.nameAr, nameEn: draft.nameEn, description: draft.description, descriptionEn: draft.descriptionEn, image: draft.image, priceFils, discountPct, available: draft.available, sizes, addons }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر حفظ الصنف");
      setDraft(null); toast(tr("حُفظ الصنف وسعره", "Item and pricing saved")); await reload();
    } catch (error) { toast(error instanceof Error ? error.message : "تعذر الاتصال", "err"); }
    finally { setBusy(false); }
  }
  async function remove(type: "category" | "item", id: number) {
    if (busy || !window.confirm(tr(type === "item" ? "حذف الصنف نهائياً من القائمة؟" : "حذف القسم؟ ستصبح أصنافه دون قسم.", type === "item" ? "Delete this menu item permanently?" : "Delete category? Its items will become uncategorized."))) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/stores/${storeId}/menu?type=${type}&id=${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر الحذف");
      toast(tr("تم الحذف", "Deleted")); await reload();
    } catch (error) { toast(error instanceof Error ? error.message : "تعذر الاتصال", "err"); }
    finally { setBusy(false); }
  }
  async function applyBulk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const percent = Number(bulkDiscount);
    if (!Number.isInteger(percent) || percent < 0 || percent > 90) return toast(tr("نسبة الخصم يجب أن تكون بين 0 و90%", "Discount must be 0–90%"), "err");
    if (!window.confirm(tr(`تطبيق خصم ${percent}% على كل الأصناف الحالية؟ سيستبدل الخصومات الفردية الموجودة.`, `Apply ${percent}% to every current item? Existing individual discounts will be replaced.`))) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/stores/${storeId}/menu`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discount_all", percent }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تطبيق الخصم");
      toast(tr(`طُبّق الخصم على ${payload.affected} صنف`, `Discount applied to ${payload.affected} items`)); await reload();
    } catch (error) { toast(error instanceof Error ? error.message : "تعذر الاتصال", "err"); }
    finally { setBusy(false); }
  }
  const visibleItems = categoryFilter === "all" ? items : items.filter((item) => String(item.categoryId ?? "none") === categoryFilter);
  if (loading) return <Spinner label={tr("جارٍ تحميل القائمة…", "Loading menu…")} />;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 font-display text-xl font-extrabold text-white"><UtensilsCrossed size={18} className="text-[#ffc531]" />{tr("قائمة الطعام والأسعار", "Menu & pricing")}</p><p className="mt-1 text-xs text-white/55">{tr("أدر أصناف المطعم مباشرة، بما فيها الأحجام والإضافات والأسعار ونسب الخصم.", "Manage categories, items, sizes, add-ons, prices and discounts directly.")}</p></div><Btn onClick={() => setDraft(newDraft())} disabled={busy}><CirclePlus size={16} />{tr("صنف جديد", "Add item")}</Btn></div>
    <div className="rounded-xl border border-white/10 bg-[#201039] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 font-bold text-white"><Layers3 size={17} className="text-[#ffc531]" />{tr("الأقسام", "Categories")}</div><button onClick={() => setCategoryDraft({ nameAr: "", nameEn: "" })} className="text-xs font-bold text-[#ffc531] hover:underline">+ {tr("إضافة قسم", "Add category")}</button></div><div className="mt-3 flex flex-wrap gap-2">{categories.map((category) => <div key={category.id} className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white/80"><span className="ps-1">{name(category)}</span><button aria-label={tr("تعديل", "Edit")} onClick={() => setCategoryDraft({ id: category.id, nameAr: category.nameAr, nameEn: category.nameEn || "" })} className="rounded-full p-1 hover:bg-white/10"><Pencil size={12} /></button><button aria-label={tr("حذف", "Delete")} onClick={() => void remove("category", category.id)} className="rounded-full p-1 text-rose-300 hover:bg-rose-500/15"><Trash2 size={12} /></button></div>)}{!categories.length && <span className="text-xs text-white/45">{tr("لا توجد أقسام بعد", "No categories yet")}</span>}</div></div>
    <form onSubmit={applyBulk} className="flex flex-wrap items-end gap-3 rounded-xl border border-[#ffc531]/25 bg-[#ffc531]/8 p-4"><div className="flex-1"><p className="flex items-center gap-2 font-bold text-[#ffc531]"><BadgePercent size={18} />{tr("خصم على كامل القائمة الحالية", "Discount the entire current menu")}</p><p className="mt-1 text-xs leading-5 text-white/55">{tr("يستبدل نسب خصومات الأصناف الحالية فقط. لتغيير طبق واحد استخدم تعديل الصنف. أدخل 0 لإزالة الخصومات عن كل الأصناف.", "Replaces each current item's discount. For one dish, edit it individually. Enter 0 to remove all current item discounts.")}</p></div><label className="text-xs font-bold text-white/70">{tr("النسبة %", "Percent %")}<input type="number" min="0" max="90" required value={bulkDiscount} onChange={(event) => setBulkDiscount(event.target.value)} placeholder="15" className="mt-1 block w-24 rounded-lg border border-white/15 bg-[#1b0a32] px-3 py-2 text-sm text-white outline-none focus:border-[#ffc531]" dir="ltr" /></label><Btn type="submit" disabled={busy || !items.length}>{tr("تطبيق على الكل", "Apply to all")}</Btn></form>
    <div className="flex flex-wrap gap-1.5"><button onClick={() => setCategoryFilter("all")} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${categoryFilter === "all" ? "bg-[#ffc531] text-[#281044]" : "bg-white/8 text-white/70"}`}>{tr("كل الأصناف", "All items")} ({items.length})</button>{categories.map((category) => <button key={category.id} onClick={() => setCategoryFilter(String(category.id))} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${categoryFilter === String(category.id) ? "bg-[#ffc531] text-[#281044]" : "bg-white/8 text-white/70"}`}>{name(category)}</button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2">{visibleItems.map((item) => <article key={item.id} className="rounded-xl border border-white/10 bg-[#201039] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-display text-lg font-extrabold text-white">{name(item)}</p><p className="mt-1 line-clamp-2 text-xs text-white/50">{locale === "en" ? item.descriptionEn || item.description : item.description}</p><p className="mt-2 text-xs text-white/55">{item.sizes.length} {tr("أحجام", "sizes")} · {item.addons.length} {tr("إضافات", "add-ons")}</p></div><span className="shrink-0 font-extrabold text-[#ffc531]">{fmtFils(item.priceFils)}</span></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3"><div className="flex gap-2"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${item.available ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}>{item.available ? tr("متوفر", "Available") : tr("غير متوفر", "Unavailable")}</span>{item.discountPct > 0 && <span className="rounded-full bg-[#ffc531]/15 px-2 py-1 text-[11px] font-bold text-[#ffc531]">{item.discountPct}% {tr("خصم", "off")}</span>}</div><div className="flex gap-2"><button onClick={() => setDraft(asDraft(item))} className="rounded-lg bg-white/8 px-2.5 py-1.5 text-xs font-bold text-[#ffc531]">{tr("تعديل", "Edit")}</button><button onClick={() => void remove("item", item.id)} className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-300">{tr("حذف", "Delete")}</button></div></div></article>)}{!visibleItems.length && <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/50 sm:col-span-2">{tr("لا توجد أصناف لهذا القسم", "No items in this category")}</p>}</div>
    <Modal open={Boolean(categoryDraft)} onClose={() => setCategoryDraft(null)} title={tr(categoryDraft?.id ? "تعديل القسم" : "قسم جديد", categoryDraft?.id ? "Edit category" : "New category")}>{categoryDraft && <form onSubmit={saveCategory} className="space-y-4"><label className="block text-xs font-bold text-[#675976]">{tr("الاسم بالعربية", "Arabic name")}<input required maxLength={100} value={categoryDraft.nameAr} onChange={(event) => setCategoryDraft({ ...categoryDraft, nameAr: event.target.value })} className={`${inputCls} mt-1`} /></label><label className="block text-xs font-bold text-[#675976]">{tr("الاسم بالإنجليزية (اختياري)", "English name (optional)")}<input maxLength={100} value={categoryDraft.nameEn} onChange={(event) => setCategoryDraft({ ...categoryDraft, nameEn: event.target.value })} className={`${inputCls} mt-1`} dir="ltr" /></label><Btn type="submit" disabled={busy} className="w-full">{tr("حفظ القسم", "Save category")}</Btn></form>}</Modal>
    <Modal open={Boolean(draft)} onClose={() => setDraft(null)} title={tr(draft?.id ? "تعديل الصنف" : "إضافة صنف", draft?.id ? "Edit item" : "Add item")} wide>{draft && <form onSubmit={saveItem} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-[#675976]">{tr("اسم الصنف بالعربية", "Arabic item name")}<input required maxLength={150} className={`${inputCls} mt-1`} value={draft.nameAr} onChange={(event) => setDraft({ ...draft, nameAr: event.target.value })} /></label><label className="text-xs font-bold text-[#675976]">{tr("الاسم بالإنجليزية", "English item name")}<input maxLength={150} className={`${inputCls} mt-1`} value={draft.nameEn} onChange={(event) => setDraft({ ...draft, nameEn: event.target.value })} dir="ltr" /></label><label className="text-xs font-bold text-[#675976]">{tr("القسم", "Category")}<select className={`${inputCls} mt-1`} value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}><option value="">{tr("دون قسم", "Uncategorized")}</option>{categories.map((category) => <option key={category.id} value={category.id}>{name(category)}</option>)}</select></label><label className="text-xs font-bold text-[#675976]">{tr("السعر الأساسي (د.ب)", "Base price (BHD)")}<input required type="number" min="0" max="10000" step="0.001" className={`${inputCls} mt-1`} value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} dir="ltr" /></label><label className="text-xs font-bold text-[#675976]">{tr("خصم الطبق %", "Item discount %")}<input required type="number" min="0" max="90" step="1" className={`${inputCls} mt-1`} value={draft.discountPct} onChange={(event) => setDraft({ ...draft, discountPct: event.target.value })} dir="ltr" /></label><label className="text-xs font-bold text-[#675976]">{tr("رابط الصورة", "Image URL")}<input type="text" maxLength={1200} className={`${inputCls} mt-1`} value={draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })} dir="ltr" /></label></div><label className="block text-xs font-bold text-[#675976]">{tr("الوصف بالعربية", "Arabic description")}<textarea maxLength={1000} rows={2} className={`${inputCls} mt-1`} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><label className="block text-xs font-bold text-[#675976]">{tr("الوصف بالإنجليزية", "English description")}<textarea maxLength={1000} rows={2} className={`${inputCls} mt-1`} value={draft.descriptionEn} onChange={(event) => setDraft({ ...draft, descriptionEn: event.target.value })} dir="ltr" /></label><label className="flex items-center gap-2 rounded-lg bg-[#f8f4ef] p-3 text-sm font-bold text-[#281044]"><input type="checkbox" checked={draft.available} onChange={(event) => setDraft({ ...draft, available: event.target.checked })} className="accent-[#281044]" />{tr("الصنف متوفر", "Item available")}</label>
      {(["sizes", "addons"] as const).map((kind) => <div key={kind} className="rounded-xl border border-[#281044]/10 p-3"><div className="flex items-center justify-between"><p className="text-sm font-extrabold text-[#281044]">{kind === "sizes" ? tr("الأحجام بأسعارها", "Sizes & prices") : tr("الإضافات بأسعارها", "Add-ons & prices")}</p><button type="button" onClick={() => setDraft({ ...draft, [kind]: [...draft[kind], { nameAr: "", price: "" }] })} className="text-xs font-bold text-[#a26412]">+ {tr("إضافة", "Add")}</button></div><div className="mt-2 space-y-2">{draft[kind].map((option, index) => <div key={`${kind}-${index}`} className="flex items-center gap-2"><input required className={inputCls} placeholder={tr("الاسم", "Name")} value={option.nameAr} onChange={(event) => setDraft({ ...draft, [kind]: draft[kind].map((entry, i) => i === index ? { ...entry, nameAr: event.target.value } : entry) })} /><input required type="number" min="0" max="10000" step="0.001" className={`${inputCls} w-28 shrink-0`} dir="ltr" placeholder="د.ب" value={option.price} onChange={(event) => setDraft({ ...draft, [kind]: draft[kind].map((entry, i) => i === index ? { ...entry, price: event.target.value } : entry) })} /><button type="button" aria-label={tr("حذف", "Remove")} onClick={() => setDraft({ ...draft, [kind]: draft[kind].filter((_, i) => i !== index) })} className="p-1.5 text-rose-600"><Trash2 size={16} /></button></div>)}{!draft[kind].length && <p className="text-xs text-[#8b8094]">{tr("لا توجد إضافات — اختياري", "None — optional")}</p>}</div></div>)}
      <p className="text-xs leading-5 text-[#746987]">{tr("تعديل سعر الأدمن مباشر. أي طلب سابق لتغيير سعر هذا الصنف يُرفض تلقائياً عند الحفظ.", "Admin price changes apply immediately; pending owner price requests for this item are automatically rejected.")}</p><Btn type="submit" disabled={busy} className="w-full py-3"><Save size={16} />{busy ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ الصنف والسعر", "Save item & pricing")}</Btn></form>}</Modal>
  </div>;
}
