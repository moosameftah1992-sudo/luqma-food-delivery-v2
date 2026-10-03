"use client";
import { useCallback, useEffect, useState } from "react";
import { Btn, Badge, Field, inputCls, ImageUpload, Spinner, Empty, Modal, downloadCSV } from "@/components/ui";
import { useL, fmtNum, fmtDate } from "@/lib/i18n";
import { card, h2, tableCls, thCls, tdCls, post } from "./sections1";

/* ================= REPORTS ================= */
export function ReportsTab() {
  const { s, lang } = useL();
  const [type, setType] = useState<"store" | "driver">("store");
  const [entities, setEntities] = useState<any[]>([]);
  const [id, setId] = useState("");
  const [from, setFrom] = useState(new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const j = type === "store" ? await post("stores-admin") : await post("drivers-admin");
      const list = type === "store" ? j.stores : j.drivers;
      setEntities(list || []);
      setId(list?.[0]?.id ? String(list[0].id) : "");
    })();
  }, [type]);

  const run = async () => {
    if (!id) return;
    setReport(await post("reports", { type, id: Number(id), from, to }));
  };

  const exportCSV = () => {
    if (!report) return;
    downloadCSV(
      `luqma-report-${type}-${from}-to-${to}.csv`,
      [s("الطلب", "Order"), s("التاريخ", "Date"), s("الحالة", "Status"), s("الإجمالي", "Total"), s("رسوم التوصيل", "Delivery fee"), s("عمولة المنصة", "Commission"), s("الصافي", "Net")],
      report.lines.map((l: any) => [l.orderNo, fmtDate(l.date, lang), l.status || "", l.total, l.deliveryFee, l.commission, l.net])
    );
  };

  return (
    <div className="space-y-4">
      <div className={card + " no-print"}>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={s("نوع التقرير", "Report type")}>
            <select className={inputCls} value={type} onChange={(e) => { setType(e.target.value as any); setReport(null); }}>
              <option value="store">{s("تقرير مطعم (مبيعات)", "Store sales report")}</option>
              <option value="driver">{s("تقرير مندوب (أرباح)", "Driver earnings report")}</option>
            </select>
          </Field>
          <Field label={type === "store" ? s("المطعم", "Store") : s("المندوب", "Driver")}>
            <select className={inputCls} value={id} onChange={(e) => setId(e.target.value)}>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.nameAr || e.name}</option>)}
            </select>
          </Field>
          <Field label={s("من", "From")}>
            <input type="date" dir="ltr" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={s("إلى", "To")}>
            <input type="date" dir="ltr" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Btn onClick={run} className="mb-0.5">{s("عرض التقرير", "Run report")}</Btn>
          <div className="ms-auto flex gap-2">
            <Btn variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10" disabled={!report} onClick={exportCSV}>{s("تصدير Excel", "Export Excel")}</Btn>
            <Btn variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10" disabled={!report} onClick={() => window.print()}>{s("تصدير PDF", "Export PDF")}</Btn>
          </div>
        </div>
      </div>

      {report && (
        <div className={card + " print-block"}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black text-white">
                {type === "store" ? s("تقرير مبيعات المطعم", "Store sales report") : s("تقرير أرباح المندوب", "Driver earnings report")}
              </h3>
              <p className="text-[11px] text-white/40" dir="ltr">{from} → {to}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                [s("الطلبات", "Orders"), report.totals.count],
                [s("الإجمالي", "Total"), fmtNum(report.totals.total)],
                [s("عمولة المنصة", "Commission"), fmtNum(report.totals.commission)],
                [s("الصافي", "Net"), fmtNum(report.totals.net)],
              ].map(([l, v], i) => (
                <div key={i} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center">
                  <p className="text-[10px] font-bold text-white/40">{l}</p>
                  <p className="text-sm font-black text-gold-400">{v}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead><tr>{[s("الطلب", "Order"), s("التاريخ", "Date"), s("الحالة", "Status"), s("الإجمالي", "Total"), s("التوصيل", "Fee"), s("العمولة", "Commission"), s("الصافي", "Net")].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
              <tbody>
                {report.lines.map((l: any) => (
                  <tr key={l.orderNo}>
                    <td className={`${tdCls} font-black`} dir="ltr">{l.orderNo}</td>
                    <td className={`${tdCls} text-white/50`}>{fmtDate(l.date, lang)}</td>
                    <td className={tdCls}>{l.status || "—"}</td>
                    <td className={`${tdCls} font-black text-gold-400`}>{fmtNum(l.total)}</td>
                    <td className={tdCls}>{fmtNum(l.deliveryFee)}</td>
                    <td className={`${tdCls} text-red-300`}>−{fmtNum(l.commission)}</td>
                    <td className={`${tdCls} font-black text-emerald-300`}>{fmtNum(l.net)}</td>
                  </tr>
                ))}
                {report.lines.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-white/40 font-bold">{s("لا توجد بيانات في هذه الفترة", "No data in this range")}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= ADMINS (MASTER ONLY) ================= */
const PERMS = [
  ["stores", "المطاعم"],
  ["orders", "الطلبات"],
  ["drivers", "المندوبون"],
  ["customers", "العملاء"],
  ["reports", "التقارير"],
  ["cms", "المحتوى"],
] as const;

export function AdminsTab() {
  const { s } = useL();
  const [admins, setAdmins] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<any>(null);
  const [f, setF] = useState({ username: "", email: "", fullName: "", password: "", permissions: [] as string[] });
  const [newPw, setNewPw] = useState("");
  const load = useCallback(() => post("admins").then((j) => setAdmins(j.admins || [])), []);
  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const j = await post("admin-create", f);
    if (j.error) alert(j.error);
    else {
      setCreating(false);
      setF({ username: "", email: "", fullName: "", password: "", permissions: [] });
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className={card + " no-print"}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className={h2 + " mb-0"}>{s("المدراء والصلاحيات (محصور بالمدير الرئيسي فقط)", "Admins & permissions (master-only)")}</h3>
          <Btn onClick={() => setCreating((v) => !v)}>{creating ? "×" : "+ " + s("مدير جديد", "New admin")}</Btn>
        </div>
        {creating && (
          <form onSubmit={create} className="mb-4 grid gap-3 rounded-xl border border-gold-500/30 bg-gold-500/5 p-4 sm:grid-cols-2">
            <Field label={s("اسم المستخدم", "Username")}><input dir="ltr" className={inputCls} value={f.username} onChange={(e) => setF((p) => ({ ...p, username: e.target.value }))} required /></Field>
            <Field label={s("البريد", "Email")}><input dir="ltr" className={inputCls} value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} required /></Field>
            <Field label={s("الاسم الكامل", "Full name")}><input className={inputCls} value={f.fullName} onChange={(e) => setF((p) => ({ ...p, fullName: e.target.value }))} /></Field>
            <Field label={s("كلمة المرور (8+)", "Password (8+)")}><input dir="ltr" type="password" className={inputCls} value={f.password} onChange={(e) => setF((p) => ({ ...p, password: e.target.value }))} minLength={8} required /></Field>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-xs font-black text-white/60">{s("الصلاحيات", "Permissions")}</p>
              <div className="flex flex-wrap gap-2">
                {PERMS.map(([k, label]) => (
                  <label key={k} className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-black cursor-pointer transition ${f.permissions.includes(k) ? "border-gold-500 bg-gold-500/10 text-gold-300" : "border-white/15 text-white/60"}`}>
                    <input type="checkbox" className="accent-gold-500" checked={f.permissions.includes(k)} onChange={(e) => setF((p) => ({ ...p, permissions: e.target.checked ? [...p.permissions, k] : p.permissions.filter((x) => x !== k) }))} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <Btn type="submit" className="sm:col-span-2">{s("إنشاء حساب المدير", "Create admin account")}</Btn>
          </form>
        )}
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead><tr>{[s("المدير", "Admin"), s("البريد", "Email"), s("النوع", "Type"), s("الصلاحيات", "Permissions"), s("نشط", "Active"), s("إجراءات", "Actions")].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td className={`${tdCls} font-black text-white`}>{a.username} <span className="block text-[10px] text-white/40">{a.fullName}</span></td>
                  <td className={`${tdCls} text-white/60`} dir="ltr">{a.email}</td>
                  <td className={tdCls}>{a.isMaster ? <Badge tone="gold">{s("رئيسي", "MASTER")}</Badge> : <Badge tone="purple">{s("فرعي", "Sub")}</Badge>}</td>
                  <td className={tdCls}>{a.isMaster ? "—" : (a.permissions || []).join("، ") || "—"}</td>
                  <td className={tdCls}>
                    {!a.isMaster && (
                      <button onClick={async () => { await post("admin-update", { id: a.id, active: !a.active }); load(); }} className={`rounded-full px-2.5 py-1 text-[10px] font-black border transition ${a.active ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-red-500/10 border-red-500/30 text-red-300"}`}>
                        {a.active ? "ON" : "OFF"}
                      </button>
                    )}
                  </td>
                  <td className={tdCls}>
                    <div className="flex gap-1.5">
                      {!a.isMaster && (
                        <>
                          <Btn variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 px-3 py-1.5 text-[11px]" onClick={async () => {
                            const perms = window.prompt(s("الصلاحيات (مفصولة بفاصلة):", "Permissions (comma separated):"), (a.permissions || []).join(","));
                            if (perms !== null) {
                              await post("admin-update", { id: a.id, permissions: perms.split(",").map((x: string) => x.trim()).filter(Boolean) });
                              load();
                            }
                          }}>{s("صلاحيات", "Perms")}</Btn>
                          <Btn className="px-3 py-1.5 text-[11px]" onClick={() => { setResetting(a); setNewPw(""); }}>{s("إعادة تعيين كلمة المرور", "Reset password")}</Btn>
                          <Btn variant="danger" className="px-3 py-1.5 text-[11px]" onClick={async () => { if (confirm(s("حذف هذا المدير؟", "Delete this admin?"))) { await post("admin-delete", { id: a.id }); load(); } }}>×</Btn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!resetting} onClose={() => setResetting(null)} title={s("إعادة تعيين كلمة مرور", "Reset password")}>
        <div className="space-y-3">
          <p className="text-xs text-white/60">{resetting?.username} — {s("كلمة المرور الجديدة (8 أحرف على الأقل)", "New password (min 8 chars)")}</p>
          <Field label={s("كلمة المرور الجديدة", "New password")}>
            <input dir="ltr" type="password" className={inputCls} value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={8} />
          </Field>
          <Btn className="w-full" disabled={newPw.length < 8} onClick={async () => { const j = await post("admin-reset-password", { id: resetting.id, password: newPw }); if (j.error) alert(j.error); setResetting(null); }}>
            {s("حفظ", "Save")}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ================= SETTINGS (payments & fees) ================= */
export function SettingsTab() {
  const { s } = useL();
  const [cfg, setCfg] = useState<any>(null);
  const [saved, setSaved] = useState("");
  const load = useCallback(() => post("settings-get").then((j) => setCfg(j.settings)), []);
  useEffect(() => { load(); }, [load]);
  if (!cfg) return <div className="py-10 text-center"><Spinner light /></div>;
  const save = async (patch: any) => {
    await post("settings-set", patch);
    setSaved(s("تم الحفظ ✓", "Saved ✓"));
    setTimeout(() => setSaved(""), 2000);
  };
  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className={h2}>{s("بوصلات الدفع (تفعيل/إيقاف)", "Payment gateways (toggle on/off)")}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["card", s("بطاقات الائتمان/الخصم", "Credit/Debit cards")],
            ["benefi", "BenefitPay"],
            ["cod", s("الدفع عند الاستلام", "Cash on delivery (COD)")],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => { const payments = { ...cfg.payments, [k]: !cfg.payments[k] }; setCfg((c: any) => ({ ...c, payments })); save({ payments }); }}
              className={`rounded-2xl border p-4 text-start transition ${cfg.payments[k] ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/10 bg-white/5 opacity-60"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-white">{label}</span>
                <span className={`h-5 w-10 rounded-full p-0.5 transition ${cfg.payments[k] ? "bg-emerald-500" : "bg-white/20"}`}>
                  <span className={`block h-4 w-4 rounded-full bg-white transition ${cfg.payments[k] ? "start-5" : ""}`} />
                </span>
              </div>
              <span className="mt-1 block text-[10px] font-bold text-white/40">{cfg.payments[k] ? s("مفعّل", "Active") : s("متوقف", "Inactive")}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={card}>
        <h3 className={h2}>{s("العمولات المالية", "Commission configuration")}</h3>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={s("عمولة المطعم (نسبة من الإيراد، الافتراضي 0.500)", "Store commission (fraction, default 0.500)")}>
            <input dir="ltr" type="number" step="0.001" className={inputCls} value={cfg.storeCommission} onChange={(e) => setCfg((c: any) => ({ ...c, storeCommission: e.target.value }))} />
          </Field>
          <Field label={s("عمولة التوصيل % (من رسوم التوصيل، الافتراضي 10%)", "Delivery commission % (default 10%)")}>
            <input dir="ltr" type="number" step="0.001" className={inputCls} value={cfg.deliveryCommission} onChange={(e) => setCfg((c: any) => ({ ...c, deliveryCommission: e.target.value }))} />
          </Field>
          <Field label={s("رقم واتساب الدعم", "Support WhatsApp number")}>
            <input dir="ltr" className={inputCls} value={cfg.whatsapp} onChange={(e) => setCfg((c: any) => ({ ...c, whatsapp: e.target.value }))} />
          </Field>
          <Btn onClick={() => save({ storeCommission: Number(cfg.storeCommission), deliveryCommission: Number(cfg.deliveryCommission), whatsapp: cfg.whatsapp })}>
            {s("حفظ", "Save")} {saved}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ================= CMS ================= */
export function CMSTab() {
  const { s } = useL();
  const [c, setC] = useState<any>(null);
  const [saved, setSaved] = useState("");
  const load = useCallback(() => post("cms-get").then((j) => setC(j.settings)), []);
  useEffect(() => { load(); }, [load]);
  if (!c) return <div className="py-10 text-center"><Spinner light /></div>;
  const saveKey = async (key: string, value: unknown) => {
    await post("cms-set", { key, value });
    setSaved(s("تم الحفظ ✓", "Saved ✓"));
    setTimeout(() => setSaved(""), 2000);
  };
  const upd = (k: string, v: any) => setC((p: any) => ({ ...p, [k]: v }));
  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className={h2}>{s("النصوص التسويقية والرئيسية", "Marketing & hero texts")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={s("عنوان رئيسي (عربي)", "Hero title (Arabic)")}>
            <input className={inputCls} value={c.heroTitleAr} onChange={(e) => upd("heroTitleAr", e.target.value)} onBlur={(e) => saveKey("heroTitleAr", e.target.value)} />
          </Field>
          <Field label={"Hero title (English)"}>
            <input dir="ltr" className={inputCls} value={c.heroTitleEn} onChange={(e) => upd("heroTitleEn", e.target.value)} onBlur={(e) => saveKey("heroTitleEn", e.target.value)} />
          </Field>
          <Field label={s("السطر الداعم (عربي)", "Hero subtitle (Arabic)")}>
            <input className={inputCls} value={c.heroSubAr} onChange={(e) => upd("heroSubAr", e.target.value)} onBlur={(e) => saveKey("heroSubAr", e.target.value)} />
          </Field>
          <Field label={"Hero subtitle (English)"}>
            <input dir="ltr" className={inputCls} value={c.heroSubEn} onChange={(e) => upd("heroSubEn", e.target.value)} onBlur={(e) => saveKey("heroSubEn", e.target.value)} />
          </Field>
          <Field label={s("شارة سريعة (Badge)", "Quick badge")}>
            <input className={inputCls} value={c.heroBadge} onChange={(e) => upd("heroBadge", e.target.value)} onBlur={(e) => saveKey("heroBadge", e.target.value)} />
          </Field>
          <Field label={s("نص الفوتر", "Footer text")}>
            <input className={inputCls} value={c.footerTextAr} onChange={(e) => upd("footerTextAr", e.target.value)} onBlur={(e) => saveKey("footerTextAr", e.target.value)} />
          </Field>
        </div>
      </div>
      <div className={card}>
        <h3 className={h2}>{s("الشعار والوسائط (تُحفظ في قاعدة البيانات)", "Logo & media (stored in the database)")}</h3>
        <div className="max-w-sm">
          <ImageUpload
            label={s("شعار لقمة الرسمي (يظهر في كل الواجهات)", "Official Luqma logo (shown across all interfaces)")}
            value={c.logoUrl}
            height={140}
            onChange={(u) => { upd("logoUrl", u); saveKey("logoUrl", u); }}
          />
        </div>
        <p className="mt-3 text-[11px] text-white/40">{s("جميع الصور المرفوعة تُخزّن ومساراتها تُسجَّل مباشرة في قاعدة بيانات Neon PostgreSQL.", "All uploaded images are stored and their paths saved directly in Neon PostgreSQL.")}</p>
      </div>
      <p className="text-[11px] font-bold text-emerald-400">{saved}</p>
    </div>
  );
}

/* ================= CANCELLED LOG ================= */
export function CancelledTab() {
  const { s, lang } = useL();
  const [log, setLog] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [storeId, setStoreId] = useState("");
  const load = useCallback(async () => {
    const j = await post("cancelled-log", { storeId: storeId || undefined });
    setLog(j.log || []);
  }, [storeId]);
  useEffect(() => {
    post("stores-admin").then((j) => setStores(j.stores || []));
    load();
  }, [load]);
  return (
    <div className={card}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className={h2 + " mb-0"}>{s("سجل الطلبات الملغية وأسبابها", "Cancelled orders log & reasons")}</h3>
        <select className={`${inputCls} max-w-52 bg-royal-950 border-white/15 text-white`} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          <option value="">{s("كل المطاعم", "All stores")}</option>
          {stores.map((st) => <option key={st.id} value={st.id}>{st.nameAr}</option>)}
        </select>
      </div>
      {log.length === 0 ? <Empty text={s("لا توجد طلبات ملغية", "No cancelled orders")} /> : (
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead><tr>{[s("الطلب", "Order"), s("المطعم", "Store"), s("العميل", "Customer"), s("المُلغي", "Cancelled by"), s("السبب", "Reason"), s("الإجمالي", "Total"), s("التاريخ", "Date")].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td className={`${tdCls} font-black`} dir="ltr">{l.orderNo}</td>
                  <td className={tdCls}>{l.storeName}</td>
                  <td className={tdCls}>{l.customerName}</td>
                  <td className={tdCls}>{l.actor === "customer" ? s("عميل", "Customer") : l.actor === "store" ? s("المطعم", "Store") : `${s("مندوب", "Driver")}${l.driverName ? " (" + l.driverName + ")" : ""}`}</td>
                  <td className={`${tdCls} text-red-300`}>{l.reason}</td>
                  <td className={`${tdCls} font-black text-gold-400`}>{fmtNum(l.total)}</td>
                  <td className={`${tdCls} text-white/50`}>{fmtDate(l.createdAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================= LOCATIONS ================= */
export function LocationsTab() {
  const { s } = useL();
  const [data, setData] = useState<any>(null);
  const [ng, setNg] = useState({ nameAr: "", nameEn: "" });
  const [na, setNa] = useState({ governorateId: "", nameAr: "", nameEn: "" });
  const load = useCallback(() => post("locations-list").then(setData), []);
  useEffect(() => { load(); }, [load]);
  if (!data) return <div className="py-10 text-center"><Spinner light /></div>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={card}>
        <h3 className={h2}>{s("المحافظات", "Governorates")}</h3>
        <div className="mb-3 flex gap-2">
          <input className={inputCls} placeholder={s("عربي", "Arabic")} value={ng.nameAr} onChange={(e) => setNg((p) => ({ ...p, nameAr: e.target.value }))} />
          <input dir="ltr" className={inputCls} placeholder="English" value={ng.nameEn} onChange={(e) => setNg((p) => ({ ...p, nameEn: e.target.value }))} />
          <Btn onClick={async () => { if (ng.nameAr) { await post("governorate-create", ng); setNg({ nameAr: "", nameEn: "" }); load(); } }}>{s("إضافة", "Add")}</Btn>
        </div>
        <ul className="space-y-1.5">
          {data.governorates.map((g: any) => (
            <li key={g.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-white/80">
              {g.nameAr} <span className="text-white/30" dir="ltr">{g.nameEn}</span>
              <button className="text-red-400 hover:text-red-300 font-black" onClick={async () => { if (confirm(s("حذف المحافظة؟", "Delete governorate?"))) { await post("governorate-delete", { id: g.id }); load(); } }}>×</button>
            </li>
          ))}
        </ul>
      </div>
      <div className={card}>
        <h3 className={h2}>{s("المناطق", "Areas")}</h3>
        <div className="mb-3 grid gap-2">
          <select className={inputCls} value={na.governorateId} onChange={(e) => setNa((p) => ({ ...p, governorateId: e.target.value }))}>
            <option value="">{s("— اختر المحافظة —", "— select governorate —")}</option>
            {data.governorates.map((g: any) => <option key={g.id} value={g.id}>{g.nameAr}</option>)}
          </select>
          <div className="flex gap-2">
            <input className={inputCls} placeholder={s("منطقة (عربي)", "Area (Arabic)")} value={na.nameAr} onChange={(e) => setNa((p) => ({ ...p, nameAr: e.target.value }))} />
            <input dir="ltr" className={inputCls} placeholder="Area (EN)" value={na.nameEn} onChange={(e) => setNa((p) => ({ ...p, nameEn: e.target.value }))} />
            <Btn onClick={async () => { if (na.governorateId && na.nameAr) { await post("area-create", na); setNa({ governorateId: "", nameAr: "", nameEn: "" }); load(); } }}>{s("إضافة", "Add")}</Btn>
          </div>
        </div>
        <ul className="max-h-80 space-y-1.5 overflow-y-auto">
          {data.areas.map((a: any) => (
            <li key={a.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-white/80">
              {a.nameAr}
              <button className="text-red-400 hover:text-red-300 font-black" onClick={async () => { if (confirm(s("حذف المنطقة؟", "Delete area?"))) { await post("area-delete", { id: a.id }); load(); } }}>×</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
