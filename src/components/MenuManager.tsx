"use client";
import { useEffect, useState } from "react";
import { Btn, Badge, Field, inputCls, ImageUpload, Modal, Spinner, Empty } from "@/components/ui";
import { useL, fmtNum } from "@/lib/i18n";

export function MenuManager({ storeId }: { storeId: number }) {
  const { s } = useL();
  const [products, setProducts] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [err, setErr] = useState("");

  const load = async () => {
    const [p, st] = await Promise.all([
      fetch(`/api/stores/${storeId}/products`).then((r) => r.json()),
      fetch("/api/stores").then((r) => r.json()),
    ]);
    setProducts(p.products || []);
    setCats(st.categories || []);
    setLoading(false);
  };
  useEffect(() => {
    if (storeId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const del = async (id: number) => {
    if (!confirm(s("حذف هذا الصنف نهائياً؟", "Delete this item permanently?"))) return;
    await fetch(`/api/stores/${storeId}/products?productId=${id}`, { method: "DELETE" });
    load();
  };

  const toggleAvail = async (p: any) => {
    await fetch(`/api/stores/${storeId}/products?productId=${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, available: !p.available }),
    });
    load();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-black text-royal-950">{s("قائمة الطعام والأصناف", "Menu & items")} <span className="text-xs text-royal-400">({products.length})</span></h3>
        <Btn onClick={() => setEditing({})}>{s("+ صنف جديد", "+ New item")}</Btn>
      </div>
      {err && <div className="mb-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-600">{err}</div>}
      {loading ? (
        <div className="py-10 text-center"><Spinner /></div>
      ) : products.length === 0 ? (
        <Empty text={s("لا توجد أصناف — أضف أول صنف في قائمتك", "No items yet — add your first item")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map((p) => (
            <div key={p.id} className="flex gap-3 rounded-2xl border border-royal-100 bg-white p-3">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-royal-100">
                {p.images?.[0] ? <img src={p.images[0]} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-royal-950">{p.nameAr}</p>
                <p className="text-[11px] font-black text-royal-600">{fmtNum(p.price)} {p.discountPercent > 0 && <span className="text-red-500">-{p.discountPercent}%</span>}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button onClick={() => toggleAvail(p)} className={`rounded-full px-2 py-0.5 text-[10px] font-black transition ${p.available ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-red-50 text-red-500 border border-red-200"}`}>
                    {p.available ? s("متوفر", "Available") : s("نفد المخزون", "Out of stock")}
                  </button>
                  <button onClick={() => setEditing(p)} className="rounded-full border border-royal-150 px-2 py-0.5 text-[10px] font-black text-royal-700 hover:border-royal-400">
                    {s("تعديل", "Edit")}
                  </button>
                  <button onClick={() => del(p.id)} className="rounded-full border border-red-100 px-2 py-0.5 text-[10px] font-black text-red-500 hover:border-red-400">
                    {s("حذف", "Delete")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <ProductEditor
          storeId={storeId}
          cats={cats}
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ProductEditor({ storeId, cats, product, onClose, onSaved }: { storeId: number; cats: any[]; product: any; onClose: () => void; onSaved: () => void }) {
  const { s } = useL();
  const isNew = !product.id;
  const [f, setF] = useState({
    nameAr: product.nameAr || "",
    nameEn: product.nameEn || "",
    description: product.description || "",
    price: product.price != null ? String(product.price) : "",
    oldPrice: product.oldPrice ? String(product.oldPrice) : "",
    discountPercent: product.discountPercent || 0,
    available: product.available ?? true,
    categoryId: product.categoryId ? String(product.categoryId) : "",
    images: (product.images || []) as string[],
  });
  const [groups, setGroups] = useState<any[]>(product.options && product.options.length ? product.options : []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const body = {
      ...f,
      options: groups.filter((g) => g.name && g.choices.length),
    };
    const r = isNew
      ? await fetch(`/api/stores/${storeId}/products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch(`/api/stores/${storeId}/products?productId=${product.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) {
      setErr(j.error || "Failed");
      setBusy(false);
      return;
    }
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={isNew ? s("صنف جديد", "New item") : s("تعديل الصنف", "Edit item")} wide>
      <form onSubmit={save} className="space-y-4">
        {err && <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-600">{err}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={s("اسم الصنف (عربي)", "Item name (Arabic)")}>
            <input className={inputCls} value={f.nameAr} onChange={(e) => setF((p) => ({ ...p, nameAr: e.target.value }))} required />
          </Field>
          <Field label={s("اسم الصنف (إنجليزي)", "Item name (English)")}>
            <input dir="ltr" className={inputCls} value={f.nameEn} onChange={(e) => setF((p) => ({ ...p, nameEn: e.target.value }))} />
          </Field>
        </div>
        <Field label={s("الوصف", "Description")}>
          <textarea className={inputCls} rows={2} value={f.description} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} />
        </Field>

        <div className="rounded-2xl border border-royal-100 bg-royal-50/40 p-4">
          <p className="mb-3 text-xs font-black text-royal-900">{s("صور الصنف — كل صورة لها زر رفع مستقل", "Item photos — each image has its own upload button")}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {f.images.slice(0, 3).map((im, i) => (
              <ImageUpload
                key={i}
                label={s(`الصورة ${i + 1}`, `Image ${i + 1}`)}
                value={im}
                height={110}
                onChange={(u) => {
                  const arr = [...f.images];
                  if (u) arr[i] = u; else arr.splice(i, 1);
                  setF((p) => ({ ...p, images: arr }));
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => setF((p) => ({ ...p, images: [...p.images, ""] }))}
              disabled={f.images.length >= 3}
              className="grid h-[130px] place-items-center rounded-xl border border-dashed border-royal-300 text-xs font-black text-royal-400 hover:border-royal-500 disabled:opacity-40 transition"
            >
              + {s("صورة إضافية", "Add image")}
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label={s("السعر (د.ب)", "Price (BD)")}>
            <input dir="ltr" type="number" step="0.001" className={inputCls} value={f.price} onChange={(e) => setF((p) => ({ ...p, price: e.target.value }))} required />
          </Field>
          <Field label={s("السعر قبل الخصم", "Old price")}>
            <input dir="ltr" type="number" step="0.001" className={inputCls} value={f.oldPrice} onChange={(e) => setF((p) => ({ ...p, oldPrice: e.target.value }))} />
          </Field>
          <Field label={s("نسبة الخصم %", "Discount %")}>
            <input dir="ltr" type="number" className={inputCls} value={f.discountPercent} onChange={(e) => setF((p) => ({ ...p, discountPercent: Number(e.target.value) || 0 }))} />
          </Field>
          <Field label={s("التصنيف", "Category")}>
            <select className={inputCls} value={f.categoryId} onChange={(e) => setF((p) => ({ ...p, categoryId: e.target.value }))}>
              <option value="">{s("— اختر —", "— select —")}</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
            </select>
          </Field>
        </div>

        {/* options builder */}
        <div className="rounded-2xl border border-royal-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-black text-royal-900">{s("الأحجام والإضافات (خيارات الصنف)", "Sizes & extras (item options)")}</p>
            <Btn type="button" variant="outline" className="px-3 py-1.5 text-[11px]" onClick={() => setGroups((g) => [...g, { name: "", nameEn: "", choices: [] }])}>
              + {s("مجموعة خيارات", "Option group")}
            </Btn>
          </div>
          <div className="space-y-3">
            {groups.length === 0 && <p className="text-[11px] text-gray-400">{s("لا توجد خيارات — مثال: الحجم (عادي/كبير)، إضافات (جبنة/صوص)", "No options yet — e.g. size (regular/large), extras (cheese/sauce)")}</p>}
            {groups.map((g, gi) => (
              <div key={gi} className="rounded-xl bg-royal-50/60 p-3">
                <div className="flex items-center gap-2">
                  <input
                    className={inputCls}
                    placeholder={s("اسم المجموعة (مثال: الحجم)", "Group name (e.g. Size)")}
                    value={g.name}
                    onChange={(e) => setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, name: e.target.value } : x)))}
                  />
                  <button type="button" className="text-red-400 hover:text-red-600 font-black" onClick={() => setGroups((gs) => gs.filter((_, i) => i !== gi))}>×</button>
                </div>
                <div className="mt-2 space-y-1.5">
                  {g.choices.map((c: any, ci: number) => (
                    <div key={ci} className="flex items-center gap-2">
                      <input
                        className={inputCls}
                        placeholder={s("الخيار (مثال: كبير)", "Choice (e.g. Large)")}
                        value={c.name}
                        onChange={(e) => setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, choices: x.choices.map((y: any, j: number) => (j === ci ? { ...y, name: e.target.value } : y)) } : x)))}
                      />
                      <input
                        dir="ltr"
                        type="number"
                        step="0.001"
                        className={`${inputCls} max-w-24`}
                        placeholder="+"
                        value={c.price}
                        onChange={(e) => setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, choices: x.choices.map((y: any, j: number) => (j === ci ? { ...y, price: Number(e.target.value) || 0 } : y)) } : x)))}
                      />
                      <button type="button" className="text-red-400 hover:text-red-600 font-black" onClick={() => setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, choices: x.choices.filter((_: any, j: number) => j !== ci) } : x)))}>×</button>
                    </div>
                  ))}
                  <button type="button" className="text-[11px] font-black text-royal-500 hover:text-royal-700" onClick={() => setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, choices: [...x.choices, { name: "", price: 0 }] } : x)))}>
                    + {s("إضافة خيار", "Add choice")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-black text-royal-800">
          <input type="checkbox" checked={f.available} onChange={(e) => setF((p) => ({ ...p, available: e.target.checked }))} className="accent-royal-700" />
          {s("متوفر (متاح للطلب)", "Available (orderable)")}
        </label>

        <div className="flex gap-2">
          <Btn type="submit" className="flex-1" disabled={busy}>{busy ? <Spinner /> : s("حفظ الصنف", "Save item")}</Btn>
          <Btn type="button" variant="outline" onClick={onClose}>{s("إلغاء", "Cancel")}</Btn>
        </div>
      </form>
    </Modal>
  );
}
