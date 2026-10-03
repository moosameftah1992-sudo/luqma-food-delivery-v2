"use client";
import { useCallback, useEffect, useState } from "react";
import { Btn, Badge, Field, inputCls, ImageUpload, Spinner, Empty, StatusBadge, Modal, downloadCSV } from "@/components/ui";
import { MenuManager } from "@/components/MenuManager";
import { useL, fmtNum, fmtDate } from "@/lib/i18n";

export const card = "rounded-2xl border border-white/10 bg-white/5 p-5";
export const h2 = "text-sm font-black text-white mb-4";
export const tableCls = "w-full text-xs";
export const thCls = "px-3 py-2.5 text-start font-black text-white/50 bg-white/5";
export const tdCls = "px-3 py-2.5 border-t border-white/5";

export function post(action: string, body: any = {}) {
  return fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) }).then((r) => r.json());
}

/* ================= OVERVIEW ================= */
export function OverviewTab() {
  const { s, lang } = useL();
  const [d, setD] = useState<any>(null);
  const load = useCallback(() => post("dashboard").then(setD), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);
  if (!d) return <div className="py-10 text-center"><Spinner light /></div>;
  const c = d.counts;
  const stats: [string, string | number, string?][] = [
    [s("المطاعم", "Stores"), c.stores, c.pendingStores ? `${c.pendingStores} ${s("قيد الموافقة", "pending")}` : ""],
    [s("المندوبون", "Drivers"), c.drivers, c.pendingDrivers ? `${c.pendingDrivers} ${s("قيد الموافقة", "pending")}` : ""],
    [s("العملاء", "Customers"), c.customers],
    [s("الطلبات", "Orders"), c.orders, c.pendingOrders ? `${c.pendingOrders} ${s("جديدة", "new")}` : ""],
    [s("إيرادات المسلّم", "Delivered revenue"), fmtNum(c.deliveredRevenue), ""],
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(([label, val, sub], i) => (
          <div key={i} className={card}>
            <p className="text-[11px] font-bold text-white/50">{label}</p>
            <p className="mt-1 text-2xl font-black text-gold-400">{val}</p>
            {sub && <p className="mt-0.5 text-[10px] font-bold text-white/40">{sub}</p>}
          </div>
        ))}
      </div>
      <div className={card}>
        <h3 className={h2}>{s("أحدث الطلبات (مباشر)", "Latest orders (live)")}</h3>
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead><tr>{[s("الطلب", "Order"), s("المطعم", "Store"), s("الحالة", "Status"), s("الإجمالي", "Total"), s("التاريخ", "Date")].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>
              {d.recent.map((o: any) => (
                <tr key={o.id}>
                  <td className={`${tdCls} font-black`} dir="ltr">{o.orderNo}</td>
                  <td className={tdCls}>{o.storeName}</td>
                  <td className={tdCls}><StatusBadge status={o.status} /></td>
                  <td className={`${tdCls} font-black text-gold-400`}>{fmtNum(o.total)}</td>
                  <td className={`${tdCls} text-white/50`}>{fmtDate(o.placedAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================= APPROVALS ================= */
export function ApprovalsTab() {
  const { s } = useL();
  const [stores, setStores] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const load = useCallback(async () => {
    const [st, dr] = await Promise.all([
      fetch("/api/stores").then((r) => r.json()),
      post("orders-all").then(() => null), // noop keepalive
    ]);
    void dr;
    const allStores = await post("stores-admin");
    setStores([...(allStores.stores || []), ...(st.pinned || []), ...(st.rotating || [])].filter((x: any, i: any, a: any) => a.findIndex((y: any) => y.id === x.id) === i));
    const allDrivers = await post("drivers-admin");
    setDrivers(allDrivers.drivers || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const pendS = stores.filter((x: any) => !x.approved);
  const pendD = drivers.filter((x: any) => !x.approved);

  return (
    <div className="space-y-5">
      <div className={card}>
        <h3 className={h2}>{s("مطاعم بانتظار الموافقة", "Stores awaiting approval")}</h3>
        {pendS.length === 0 ? <Empty text={s("لا توجد طلبات شراكة معلّقة", "No pending partnerships")} /> : (
          <div className="space-y-3">
            {pendS.map((st: any) => (
              <div key={st.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gold-500/30 bg-gold-500/5 p-3">
                <div className="h-14 w-14 overflow-hidden rounded-xl bg-white/10">
                  {st.logoUrl ? <img src={st.logoUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center font-black text-gold-400">{st.nameAr?.[0]}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">{st.nameAr} <span className="text-[10px] text-white/40" dir="ltr">{st.nameEn}</span></p>
                  <p className="text-[11px] text-white/50">{st.email} · {st.phone}</p>
                  {st.bannerUrl && <a href={st.bannerUrl} target="_blank" rel="noreferrer" className="text-[10px] font-black text-gold-400 underline">{s("عرض البانر", "View banner")}</a>}
                </div>
                <div className="flex gap-2">
                  <Btn className="px-3 py-1.5 text-[11px]" onClick={async () => { await post("store-approve", { id: st.id, approve: true }); load(); }}>{s("موافقة ✓", "Approve ✓")}</Btn>
                  <Btn variant="danger" className="px-3 py-1.5 text-[11px]" onClick={async () => { if (confirm(s("رفض وحذف هذا المطعم؟", "Reject and delete?"))) { await post("store-delete", { id: st.id }); load(); } }}>{s("رفض", "Reject")}</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={card}>
        <h3 className={h2}>{s("مندوبون بانتظار الموافقة (وثائقهم)", "Drivers awaiting approval (their documents)")}</h3>
        {pendD.length === 0 ? <Empty text={s("لا توجد طلبات انضمام معلّقة", "No pending applications")} /> : (
          <div className="space-y-3">
            {pendD.map((dr: any) => (
              <div key={dr.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gold-500/30 bg-gold-500/5 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">{dr.name}</p>
                  <p className="text-[11px] text-white/50">{dr.email} · {dr.phone} · {dr.vehicle}</p>
                </div>
                <div className="flex gap-2">
                  <a href={dr.idCardUrl || "#"} target="_blank" rel="noreferrer" className="rounded-xl border border-white/20 px-3 py-1.5 text-[11px] font-black text-white/80 hover:bg-white/10" onClick={(e) => !dr.idCardUrl && e.preventDefault()}>
                    {s("بطاقة الهوية", "ID card")}
                  </a>
                  <a href={dr.licenseUrl || "#"} target="_blank" rel="noreferrer" className="rounded-xl border border-white/20 px-3 py-1.5 text-[11px] font-black text-white/80 hover:bg-white/10" onClick={(e) => !dr.licenseUrl && e.preventDefault()}>
                    {s("رخصة القيادة", "License")}
                  </a>
                  <Btn className="px-3 py-1.5 text-[11px]" onClick={async () => { await post("driver-approve", { id: dr.id, approve: true }); load(); }}>{s("موافقة ✓", "Approve ✓")}</Btn>
                  <Btn variant="danger" className="px-3 py-1.5 text-[11px]" onClick={async () => { if (confirm(s("حذف هذا المندوب؟", "Delete this driver?"))) { await post("driver-delete", { id: dr.id }); load(); } }}>×</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= ORDERS ALL ================= */
export function OrdersAllTab() {
  const { s, lang } = useL();
  const [orders, setOrders] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [storeId, setStoreId] = useState("");
  const [stores, setStores] = useState<any[]>([]);
  const load = useCallback(async () => {
    const j = await post("orders-all", { status: status || undefined, storeId: storeId || undefined });
    setOrders(j.orders || []);
  }, [status, storeId]);
  useEffect(() => {
    fetch("/api/stores").then((r) => r.json()).then((j) => setStores([...(j.pinned || []), ...(j.rotating || [])]));
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className={card}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className={h2 + " mb-0"}>{s("كل الطلبات", "All orders")}</h3>
        <select className={`${inputCls} max-w-40 bg-royal-950 border-white/15 text-white`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{s("كل الحالات", "All statuses")}</option>
          {["pending", "accepted", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"].map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
        <select className={`${inputCls} max-w-48 bg-royal-950 border-white/15 text-white`} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          <option value="">{s("كل المطاعم", "All stores")}</option>
          {stores.map((st) => <option key={st.id} value={st.id}>{st.nameAr}</option>)}
        </select>
        <Btn variant="outline" className="ms-auto border-white/25 bg-transparent text-white hover:bg-white/10 px-3 py-1.5 text-[11px]" onClick={() => downloadCSV("luqma-orders.csv", [s("الطلب", "Order"), s("المطعم", "Store"), s("الحالة", "Status"), s("الإجمالي", "Total"), s("التاريخ", "Date")], orders.map((o) => [o.orderNo, o.storeName, o.status, o.total, fmtDate(o.placedAt, lang)]))}>
          {s("تصدير Excel", "Export Excel")}
        </Btn>
      </div>
      <div className="overflow-x-auto">
        <table className={tableCls}>
          <thead><tr>{[s("الطلب", "Order"), s("المطعم", "Store"), s("العميل", "Customer"), s("الحالة", "Status"), s("الدفع", "Pay"), s("الإجمالي", "Total"), s("التاريخ", "Date")].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className={`${tdCls} font-black`} dir="ltr">{o.orderNo}</td>
                <td className={tdCls}>{o.storeName}</td>
                <td className={tdCls}>{o.customerName}</td>
                <td className={tdCls}><StatusBadge status={o.status} /></td>
                <td className={tdCls}>{o.paymentMethod}</td>
                <td className={`${tdCls} font-black text-gold-400`}>{fmtNum(o.total)}</td>
                <td className={`${tdCls} text-white/50`}>{fmtDate(o.placedAt, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <Empty text={s("لا توجد طلبات", "No orders")} />}
      </div>
    </div>
  );
}

/* ================= STORES ================= */
export function StoresTab() {
  const { s } = useL();
  const [stores, setStores] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [locs, setLocs] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const load = useCallback(async () => {
    const j = await post("stores-admin");
    setStores(j.stores || []);
    const st = await fetch("/api/stores").then((r) => r.json());
    setCats(st.categories || []);
    setLocs(await fetch("/api/locations").then((r) => r.json()));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className={card}>
      <h3 className={h2}>{s("إدارة المطاعم — تحكم كامل (لوقو، قائمة، ساعات، تمييز)", "Stores management — full control (logo, menu, hours, pinning)")}</h3>
      <div className="overflow-x-auto">
        <table className={tableCls}>
          <thead><tr>{[s("المطعم", "Store"), s("الحالة", "Status"), s("الاعتماد", "Approved"), s("مميز", "Pinned"), s("خصم", "Disc"), s("إجراء", "Actions")].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {stores.map((st) => (
              <tr key={st.id}>
                <td className={tdCls}>
                  <span className="font-black text-white">{st.nameAr}</span>
                  <span className="block text-[10px] text-white/40" dir="ltr">{st.email}</span>
                </td>
                <td className={tdCls}>{st.status}</td>
                <td className={tdCls}>{st.approved ? <Badge tone="green">{s("مفعّل", "Active")}</Badge> : <Badge tone="gold">{s("قيد المراجعة", "Pending")}</Badge>}</td>
                <td className={tdCls}>
                  <button onClick={async () => { await post("store-pin", { id: st.id, pinned: !st.pinned }); load(); }} className={`rounded-full px-2.5 py-1 text-[10px] font-black border transition ${st.pinned ? "bg-gold-500 text-royal-950 border-gold-500" : "border-white/20 text-white/50 hover:bg-white/10"}`}>
                    {st.pinned ? s("مميز ★", "Pinned ★") : s("تمييز", "Pin")}
                  </button>
                </td>
                <td className={tdCls}>{st.discountPercent > 0 ? <Badge tone="red">-{st.discountPercent}%</Badge> : "—"}</td>
                <td className={tdCls}>
                  <div className="flex gap-1.5">
                    <Btn variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 px-3 py-1.5 text-[11px]" onClick={() => setDetail(st)}>{s("تحكم كامل", "Full control")}</Btn>
                    <Btn variant="danger" className="px-3 py-1.5 text-[11px]" onClick={async () => { if (confirm(s("حذف هذا المطعم نهائياً؟", "Delete this store permanently?"))) { await post("store-delete", { id: st.id }); load(); } }}>×</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && <StoreDetailModal store={detail} cats={cats} locs={locs} onClose={() => setDetail(null)} onSaved={async () => { setDetail(null); load(); }} />}
    </div>
  );
}

function StoreDetailModal({ store, cats, locs, onClose, onSaved }: { store: any; cats: any[]; locs: any; onClose: () => void; onSaved: () => void }) {
  const { s } = useL();
  const [f, setF] = useState<any>({ ...store });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setBusy(true);
    setErr("");
    const j = await post("store-update", { id: store.id, ...f });
    if (j.error) setErr(j.error);
    setBusy(false);
    onSaved();
  };
  const setHour = (i: number, k: string, v: any) => {
    const wh = [...(f.workingHours || [])];
    wh[i] = { ...wh[i], [k]: v };
    setF((p: any) => ({ ...p, workingHours: wh }));
  };
  return (
    <Modal open onClose={onClose} title={`${s("تحكم كامل في", "Full control of")} ${store.nameAr}`} wide>
      <div className="space-y-5">
        {err && <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-600">{err}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageUpload label={s("لوقو المطعم (رفع مستقل)", "Store logo (independent upload)")} value={f.logoUrl} onChange={(u) => setF((p: any) => ({ ...p, logoUrl: u }))} />
          <ImageUpload label={s("صورة البانر (رفع مستقل)", "Store banner (independent upload)")} value={f.bannerUrl} onChange={(u) => setF((p: any) => ({ ...p, bannerUrl: u }))} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={s("الاسم (عربي)", "Name (Arabic)")}><input className={inputCls} value={f.nameAr} onChange={(e) => setF((p: any) => ({ ...p, nameAr: e.target.value }))} /></Field>
          <Field label={s("الاسم (إنجليزي)", "Name (English)")}><input dir="ltr" className={inputCls} value={f.nameEn} onChange={(e) => setF((p: any) => ({ ...p, nameEn: e.target.value }))} /></Field>
        </div>
        <Field label={s("الوصف", "Description")}><textarea className={inputCls} rows={2} value={f.description} onChange={(e) => setF((p: any) => ({ ...p, description: e.target.value }))} /></Field>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label={s("رسوم التوصيل", "Delivery fee")}><input dir="ltr" type="number" step="0.01" className={inputCls} value={f.deliveryFee} onChange={(e) => setF((p: any) => ({ ...p, deliveryFee: e.target.value }))} /></Field>
          <Field label={s("الحد الأدنى", "Min order")}><input dir="ltr" type="number" step="0.01" className={inputCls} value={f.minOrder} onChange={(e) => setF((p: any) => ({ ...p, minOrder: e.target.value }))} /></Field>
          <Field label={s("الخصم %", "Discount %")}><input dir="ltr" type="number" className={inputCls} value={f.discountPercent} onChange={(e) => setF((p: any) => ({ ...p, discountPercent: e.target.value }))} /></Field>
          <Field label={s("التصنيف", "Category")}>
            <select className={inputCls} value={f.categoryId || ""} onChange={(e) => setF((p: any) => ({ ...p, categoryId: e.target.value || null }))}>
              <option value="">—</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={s("المحافظة", "Governorate")}>
            <select className={inputCls} value={f.governorateId || ""} onChange={(e) => setF((p: any) => ({ ...p, governorateId: e.target.value || null }))}>
              <option value="">—</option>
              {(locs?.governorates || []).map((g: any) => <option key={g.id} value={g.id}>{g.nameAr}</option>)}
            </select>
          </Field>
          <Field label={s("المنطقة", "Area")}>
            <select className={inputCls} value={f.areaId || ""} onChange={(e) => setF((p: any) => ({ ...p, areaId: e.target.value || null }))}>
              <option value="">—</option>
              {(locs?.areas || []).filter((a: any) => !f.governorateId || String(a.governorateId) === String(f.governorateId)).map((a: any) => <option key={a.id} value={a.id}>{a.nameAr}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-black text-white/80">
            <input type="checkbox" checked={!!f.pinned} onChange={(e) => setF((p: any) => ({ ...p, pinned: e.target.checked }))} className="accent-gold-500" />
            {s("تمييز في أعلى الرئيسية (مثبت)", "Pin to top of homepage")}
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-black text-white/80">
            <input type="checkbox" checked={!!f.approved} onChange={(e) => setF((p: any) => ({ ...p, approved: e.target.checked }))} className="accent-emerald-500" />
            {s("معتمد ونشط", "Approved & active")}
          </label>
          <select className={`${inputCls} max-w-32`} value={f.status} onChange={(e) => setF((p: any) => ({ ...p, status: e.target.value }))}>
            <option value="open">open</option><option value="busy">busy</option><option value="closed">closed</option>
          </select>
        </div>

        {/* working hours */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-black text-white">{s("أوقات العمل (حتى 3 فترات)", "Working hours (up to 3 shifts)")}</p>
            <Btn variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 px-3 py-1.5 text-[11px]" disabled={(f.workingHours || []).length >= 3} onClick={() => setF((p: any) => ({ ...p, workingHours: [...(p.workingHours || []), { from: "11:00", to: "22:00", enabled: true }] }))}>
              + {s("فترة", "Shift")}
            </Btn>
          </div>
          <div className="space-y-2">
            {(f.workingHours || []).map((h: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-14 text-[11px] font-black text-white/40">{s("فترة", "Shift")} {i + 1}</span>
                <input dir="ltr" type="time" className={inputCls} value={h.from} onChange={(e) => setHour(i, "from", e.target.value)} />
                <span className="text-white/40">←</span>
                <input dir="ltr" type="time" className={inputCls} value={h.to} onChange={(e) => setHour(i, "to", e.target.value)} />
                <label className="flex items-center gap-1 text-[11px] font-black text-white/70">
                  <input type="checkbox" checked={h.enabled} onChange={(e) => setHour(i, "enabled", e.target.checked)} className="accent-gold-500" /> On
                </label>
                <button className="ms-auto text-red-400 font-black" onClick={() => setF((p: any) => ({ ...p, workingHours: (p.workingHours || []).filter((_: any, j: number) => j !== i) }))}>×</button>
              </div>
            ))}
          </div>
        </div>

        {/* full menu control */}
        <div>
          <MenuManager storeId={store.id} />
        </div>

        <div className="flex gap-2">
          <Btn className="flex-1" disabled={busy} onClick={save}>{busy ? <Spinner /> : s("حفظ كل التغييرات", "Save all changes")}</Btn>
          <Btn variant="outline" className="border-royal-200 text-royal-800" onClick={onClose}>{s("إغلاق", "Close")}</Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ================= DRIVERS ================= */
export function DriversTab() {
  const { s } = useL();
  const [drivers, setDrivers] = useState<any[]>([]);
  const load = useCallback(async () => {
    const j = await post("drivers-admin");
    setDrivers(j.drivers || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className={card}>
      <h3 className={h2}>{s("إدارة المندوبين", "Drivers management")}</h3>
      <div className="overflow-x-auto">
        <table className={tableCls}>
          <thead><tr>{[s("المندوب", "Driver"), s("المركبة", "Vehicle"), s("متصل", "Online"), s("موافق", "Approved"), s("نشط", "Active"), s("وثائق", "Docs"), s("إجراء", "Actions")].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {drivers.map((dr) => (
              <tr key={dr.id}>
                <td className={tdCls}>
                  <span className="font-black text-white">{dr.name}</span>
                  <span className="block text-[10px] text-white/40" dir="ltr">{dr.email}</span>
                </td>
                <td className={tdCls}>{dr.vehicle || "—"}</td>
                <td className={tdCls}>{dr.isOnline ? <Badge tone="green">{s("متصل", "Online")}</Badge> : <Badge tone="gray">{s("غير متصل", "Offline")}</Badge>}</td>
                <td className={tdCls}>{dr.approved ? <Badge tone="green">✓</Badge> : <Badge tone="gold">{s("قيد المراجعة", "Pending")}</Badge>}</td>
                <td className={tdCls}>
                  <button onClick={async () => { await post("driver-set-active", { id: dr.id, active: !dr.active }); load(); }} className={`rounded-full px-2.5 py-1 text-[10px] font-black border transition ${dr.active ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-red-500/10 border-red-500/30 text-red-300"}`}>
                    {dr.active ? "ON" : "OFF"}
                  </button>
                </td>
                <td className={tdCls}>
                  <div className="flex gap-1.5">
                    <a href={dr.idCardUrl || "#"} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 px-2 py-1 text-[10px] font-black text-white/70 hover:bg-white/10" onClick={(e) => !dr.idCardUrl && e.preventDefault()}>{s("هوية", "ID")}</a>
                    <a href={dr.licenseUrl || "#"} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 px-2 py-1 text-[10px] font-black text-white/70 hover:bg-white/10" onClick={(e) => !dr.licenseUrl && e.preventDefault()}>{s("رخصة", "License")}</a>
                  </div>
                </td>
                <td className={tdCls}>
                  <div className="flex gap-1.5">
                    <Btn variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 px-3 py-1.5 text-[11px]" onClick={async () => { await post("driver-approve", { id: dr.id, approve: !dr.approved }); load(); }}>
                      {dr.approved ? s("إلغاء الموافقة", "Revoke") : s("موافقة", "Approve")}
                    </Btn>
                    <Btn variant="danger" className="px-3 py-1.5 text-[11px]" onClick={async () => { if (confirm(s("حذف المندوب؟", "Delete driver?"))) { await post("driver-delete", { id: dr.id }); load(); } }}>×</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= CUSTOMERS ================= */
export function CustomersTab() {
  const { s } = useL();
  const [customers, setCustomers] = useState<any[]>([]);
  const [bonusModal, setBonusModal] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const load = useCallback(async () => {
    const j = await post("customers-admin");
    setCustomers(j.customers || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className={card}>
      <h3 className={h2}>{s("إدارة العملاء والبونس", "Customers & bonus management")}</h3>
      <div className="overflow-x-auto">
        <table className={tableCls}>
          <thead><tr>{[s("العميل", "Customer"), s("البريد", "Email"), s("البونس", "Bonus"), s("مفعل", "Verified"), s("إجراءات", "Actions")].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td className={`${tdCls} font-black text-white`}>{c.name}</td>
                <td className={`${tdCls} text-white/60`} dir="ltr">{c.email}</td>
                <td className={`${tdCls} font-black text-gold-400`}>{fmtNum(c.bonusBalance)}</td>
                <td className={tdCls}>{c.emailVerified ? <Badge tone="green">✓</Badge> : <Badge tone="gold">{s("غير مفعل", "Unverified")}</Badge>}</td>
                <td className={tdCls}>
                  <div className="flex gap-1.5">
                    <Btn className="px-3 py-1.5 text-[11px]" onClick={() => { setBonusModal(c); setAmount(""); }}>+ {s("بونس", "Bonus")}</Btn>
                    <Btn variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 px-3 py-1.5 text-[11px]" onClick={async () => { await post("customer-set-verified", { id: c.id, verified: !c.emailVerified }); load(); }}>
                      {c.emailVerified ? s("إلغاء التفعيل", "Unverify") : s("تفعيل", "Verify")}
                    </Btn>
                    <Btn variant="danger" className="px-3 py-1.5 text-[11px]" onClick={async () => { if (confirm(s("حذف العميل؟", "Delete customer?"))) { await post("customer-delete", { id: c.id }); load(); } }}>×</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && <Empty text={s("لا يوجد عملاء", "No customers")} />}
      </div>
      <Modal open={!!bonusModal} onClose={() => setBonusModal(null)} title={s("تخصيص بونس", "Allocate bonus")}>
        <div className="space-y-3">
          <p className="text-xs text-white/60">{bonusModal?.name} — {s("الرصيد الحالي", "current")} {fmtNum(bonusModal?.bonusBalance)}</p>
          <Field label={s("المبلغ المضاف (د.ب)", "Amount to add (BD)")}>
            <input dir="ltr" type="number" step="0.01" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Btn className="w-full" onClick={async () => { await post("customer-add-bonus", { id: bonusModal.id, amount: Number(amount) }); setBonusModal(null); load(); }}>
            {s("تخصيص", "Allocate")}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
