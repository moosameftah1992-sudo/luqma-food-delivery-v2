"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, Badge, Field, inputCls, ImageUpload, Logo, LangToggle, Spinner, Empty, StatusBadge, useAudioAlert, downloadCSV, Modal } from "@/components/ui";
import { MenuManager } from "@/components/MenuManager";
import { useL, fmtNum, fmtDate } from "@/lib/i18n";

export default function StoreDashboard() {
  const router = useRouter();
  const { s, lang } = useL();
  const [store, setStore] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [tab, setTab] = useState<"orders" | "menu" | "hours" | "settings">("orders");
  const [soundOn, setSoundOn] = useState(true);
  const [rejecting, setRejecting] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  useAudioAlert(pendingCount > 0, "continuous", soundOn);

  const load = useCallback(async () => {
    const r = await fetch("/api/me/store");
    if (r.status === 401) {
      router.replace("/partner/store");
      return;
    }
    const j = await r.json();
    if (j.store) setStore(j.store);
    const or = await fetch("/api/orders?scope=store");
    if (or.ok) {
      const oj = await or.json();
      setOrders(oj.orders || []);
    }
  }, [router]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (id: number, action: string, extra?: any) => {
    const r = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const j = await r.json();
    if (j.error) setErr(j.error);
    load();
  };

  const logout = async () => {
    await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout", role: "store" }) });
    router.push("/");
  };

  if (!store) return <div className="grid min-h-screen place-items-center bg-royal-950"><Spinner light /></div>;

  const groups = {
    pending: orders.filter((o) => o.status === "pending"),
    active: orders.filter((o) => ["accepted", "preparing", "ready", "out_for_delivery"].includes(o.status)),
    past: orders.filter((o) => ["delivered", "cancelled"].includes(o.status)).slice(0, 10),
  };

  const saveHours = async () => {
    setBusy(true);
    await fetch(`/api/stores/${store.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workingHours: store.workingHours }) });
    setBusy(false);
    load();
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch(`/api/stores/${store.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nameAr: store.nameAr, nameEn: store.nameEn, description: store.description,
        deliveryFee: store.deliveryFee, minOrder: store.minOrder, discountPercent: Number(store.discountPercent) || 0,
        logoUrl: store.logoUrl, bannerUrl: store.bannerUrl, status: store.status,
      }),
    });
    const j = await r.json();
    if (j.error) setErr(j.error);
    setBusy(false);
    load();
  };

  const setHour = (i: number, k: string, v: any) => {
    const wh = [...(store.workingHours || [])];
    wh[i] = { ...wh[i], [k]: v };
    setStore((st: any) => ({ ...st, workingHours: wh }));
  };

  const exportCSV = () => {
    downloadCSV(
      `luqma-store-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      [s("الطلب", "Order"), s("الحالة", "Status"), s("التاريخ", "Date"), s("الإجمالي", "Total"), s("الطريقة", "Payment"), s("العميل", "Customer")],
      orders.map((o) => [o.orderNo, o.status, fmtDate(o.placedAt, lang), o.total, o.paymentMethod, o.customerName])
    );
  };

  return (
    <div className="min-h-screen bg-royal-50">
      {/* top bar */}
      <header className="no-print sticky top-0 z-40 bg-royal-950 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo size={38} />
            <div className="hidden sm:block">
              <p className="text-sm font-black">{store.nameAr}</p>
              <p className="text-[10px] text-white/50">{s("لوحة تحكم المطعم", "Store control dashboard")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="alert-ring flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-black">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a6 6 0 0 0-6 6v4l-2 4h16l-2-4V8a6 6 0 0 0-6-6zm-2 16a2 2 0 0 0 4 0z"/></svg>
                {pendingCount} {s("طلب جديد", "new order(s)")}
              </span>
            )}
            <button onClick={() => setSoundOn((v) => !v)} className={`rounded-full px-3 py-1.5 text-[11px] font-black border transition ${soundOn ? "bg-gold-500 text-royal-950 border-gold-500" : "border-white/25 text-white/60"}`}>
              {soundOn ? s("الصوت: يعمل", "Sound: on") : s("الصوت: متوقف", "Sound: off")}
            </button>
            <LangToggle />
            <button onClick={logout} className="rounded-full border border-white/25 px-3 py-1.5 text-[11px] font-black hover:bg-white/10">{s("خروج", "Logout")}</button>
          </div>
        </div>
        {!store.approved && (
          <div className="bg-gold-500 px-4 py-1.5 text-center text-[11px] font-black text-royal-950">
            {s("مطعمك قيد الموافقة من الإدارة — لن يظهر للعملاء حتى الاعتماد النهائي.", "Your store is awaiting final admin approval — customers cannot see it yet.")}
          </div>
        )}
      </header>

      {/* status quick switch */}
      <div className="no-print bg-white/70 border-b border-royal-100">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5">
          <span className="text-[11px] font-black text-royal-500">{s("الحالة الآن:", "Current status:")}</span>
          {[["open", s("مفتوح", "Open"), "bg-emerald-500"], ["busy", s("مشغول", "Busy"), "bg-gold-500"], ["closed", s("مغلق", "Closed"), "bg-red-500"]].map(([k, label, color]) => (
            <button
              key={k}
              onClick={() => fetch(`/api/stores/${store.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: k }) }).then(() => load())}
              className={`rounded-full px-4 py-1.5 text-[11px] font-black transition ${store.status === k ? `${color} text-white shadow-md` : "bg-royal-50 text-royal-500 hover:bg-royal-100"}`}
            >
              {label}
            </button>
          ))}
          <div className="ms-auto flex gap-1.5">
            <button onClick={() => setTab("orders")} className={`rounded-full px-4 py-1.5 text-[11px] font-black ${tab === "orders" ? "bg-royal-900 text-white" : "bg-royal-50 text-royal-600"}`}>{s("الطلبات", "Orders")}{groups.pending.length > 0 && <span className="ms-1 rounded-full bg-red-500 px-1.5 text-white">{groups.pending.length}</span>}</button>
            <button onClick={() => setTab("menu")} className={`rounded-full px-4 py-1.5 text-[11px] font-black ${tab === "menu" ? "bg-royal-900 text-white" : "bg-royal-50 text-royal-600"}`}>{s("القائمة", "Menu")}</button>
            <button onClick={() => setTab("hours")} className={`rounded-full px-4 py-1.5 text-[11px] font-black ${tab === "hours" ? "bg-royal-900 text-white" : "bg-royal-50 text-royal-600"}`}>{s("أوقات العمل", "Hours")}</button>
            <button onClick={() => setTab("settings")} className={`rounded-full px-4 py-1.5 text-[11px] font-black ${tab === "settings" ? "bg-royal-900 text-white" : "bg-royal-50 text-royal-600"}`}>{s("الإعدادات", "Settings")}</button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {err && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-600">{err}</div>}

        {tab === "orders" && (
          <div className="space-y-6">
            {/* PENDING — flashing until accepted */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-royal-950">
                {s("طلبات جديدة تحتاج قبول", "New orders to accept")}
                {groups.pending.length > 0 && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
              </h2>
              {groups.pending.length === 0 ? (
                <Empty text={s("لا توجد طلبات جديدة حالياً — سننبهك صوتياً وبصرياً فور وصول أي طلب", "No new orders right now — you'll get an audio+visual alert instantly")} />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {groups.pending.map((o) => (
                    <OrderCard key={o.id} o={o} alert>
                      <div className="mt-3 flex gap-2">
                        <Btn className="flex-1" onClick={() => act(o.id, "accept")}>{s("قبول الطلب ✓", "Accept order ✓")}</Btn>
                        <Btn variant="danger" onClick={() => { setRejecting(o); setRejectReason(""); }}>{s("رفض", "Reject")}</Btn>
                      </div>
                    </OrderCard>
                  ))}
                </div>
              )}
            </section>

            {/* ACTIVE */}
            <section>
              <h2 className="mb-3 text-sm font-black text-royal-950">{s("طلبات قيد التنفيذ", "Orders in progress")}</h2>
              {groups.active.length === 0 ? (
                <Empty text={s("لا توجد طلبات نشطة", "No active orders")} />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {groups.active.map((o) => (
                    <OrderCard key={o.id} o={o}>
                      <div className="mt-3">
                        {o.status === "accepted" && <Btn className="w-full" onClick={() => act(o.id, "preparing")}>{s("بدء التحضير (قيد التحضير)", "Start preparing")}</Btn>}
                        {o.status === "preparing" && <Btn className="w-full" onClick={() => act(o.id, "ready")}>{s("الطلب جاهز — إرسال للمندوبين ✓", "Order ready — broadcast to drivers ✓")}</Btn>}
                        {o.status === "ready" && (
                          <div className="rounded-xl bg-gold-100 border border-gold-300 px-3 py-2 text-[11px] font-black text-gold-700">
                            {o.driver ? s("المندوب في الطريق الآن", "Driver is on the way") : s("بانتظار قبول أحد المندوبين المتصلين…", "Waiting for an online driver to accept…")}
                          </div>
                        )}
                        {o.status === "out_for_delivery" && (
                          <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 text-[11px] font-black text-sky-700">
                            {s("قيد التوصيل", "Out for delivery")} {o.driver && `— ${o.driver.name}`}
                          </div>
                        )}
                      </div>
                    </OrderCard>
                  ))}
                </div>
              )}
            </section>

            {/* PAST */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black text-royal-950">{s("السجل (آخر الطلبات)", "History (recent)")}</h2>
                <Btn variant="outline" className="px-3 py-1.5 text-[11px]" onClick={exportCSV}>{s("تصدير Excel", "Export Excel")}</Btn>
              </div>
              {groups.past.length === 0 ? (
                <Empty text={s("لا يوجد سجل بعد", "No history yet")} />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-royal-100 bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-royal-50 text-royal-600">
                      <tr>{[s("الطلب", "Order"), s("الحالة", "Status"), s("التاريخ", "Date"), s("الإجمالي", "Total"), s("الدفع", "Pay"), s("العميل", "Customer")].map((h) => <th key={h} className="px-3 py-2.5 text-start font-black">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {groups.past.map((o) => (
                        <tr key={o.id} className="border-t border-royal-50">
                          <td className="px-3 py-2 font-black" dir="ltr">{o.orderNo}</td>
                          <td className="px-3 py-2"><StatusBadge status={o.status} /></td>
                          <td className="px-3 py-2 text-gray-500">{fmtDate(o.placedAt, lang)}</td>
                          <td className="px-3 py-2 font-black">{fmtNum(o.total)}</td>
                          <td className="px-3 py-2">{o.paymentMethod}</td>
                          <td className="px-3 py-2">{o.customerName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "menu" && <MenuManager storeId={store.id} />}

        {tab === "hours" && (
          <div className="max-w-xl rounded-2xl border border-royal-100 bg-white p-5">
            <h2 className="text-sm font-black text-royal-950">{s("أوقات العمل (فترات 1–3)", "Working hours (1–3 shifts)")}</h2>
            <p className="mt-1 text-[11px] text-gray-500">{s("حدد حتى ثلاث فترات عمل يومياً مع ساعة البداية والنهاية.", "Define up to three daily shifts with from/to times.")}</p>
            <div className="mt-4 space-y-3">
              {(store.workingHours || []).map((h: any, i: number) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-royal-50/60 p-3">
                  <span className="text-xs font-black text-royal-500">{s("فترة", "Shift")} {i + 1}</span>
                  <input dir="ltr" type="time" className={inputCls} value={h.from} onChange={(e) => setHour(i, "from", e.target.value)} />
                  <span className="text-xs font-black text-royal-400">←</span>
                  <input dir="ltr" type="time" className={inputCls} value={h.to} onChange={(e) => setHour(i, "to", e.target.value)} />
                  <label className="flex items-center gap-1.5 text-[11px] font-black text-royal-700">
                    <input type="checkbox" checked={h.enabled} onChange={(e) => setHour(i, "enabled", e.target.checked)} className="accent-royal-700" />
                    {s("مفعّلة", "On")}
                  </label>
                  {(store.workingHours || []).length > 1 && (
                    <button className="ms-auto text-red-400 hover:text-red-600 font-black" onClick={() => {
                      const wh = (store.workingHours || []).filter((_: any, j: number) => j !== i);
                      setStore((st: any) => ({ ...st, workingHours: wh }));
                    }}>×</button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              {(store.workingHours || []).length < 3 && (
                <Btn variant="outline" onClick={() => setStore((st: any) => ({ ...st, workingHours: [...(st.workingHours || []), { from: "11:00", to: "22:00", enabled: true }] }))}>
                  + {s("إضافة فترة", "Add shift")}
                </Btn>
              )}
              <Btn className="ms-auto" disabled={busy} onClick={saveHours}>{busy ? <Spinner /> : s("حفظ أوقات العمل", "Save working hours")}</Btn>
            </div>
          </div>
        )}

        {tab === "settings" && (
          <form onSubmit={saveSettings} className="max-w-2xl space-y-5">
            <div className="rounded-2xl border border-royal-100 bg-white p-5 space-y-3">
              <h2 className="text-sm font-black text-royal-950">{s("بيانات المطعم", "Store profile")}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={s("الاسم (عربي)", "Name (Arabic)")}>
                  <input className={inputCls} value={store.nameAr} onChange={(e) => setStore((st: any) => ({ ...st, nameAr: e.target.value }))} />
                </Field>
                <Field label={s("الاسم (إنجليزي)", "Name (English)")}>
                  <input dir="ltr" className={inputCls} value={store.nameEn} onChange={(e) => setStore((st: any) => ({ ...st, nameEn: e.target.value }))} />
                </Field>
              </div>
              <Field label={s("الوصف", "Description")}>
                <textarea className={inputCls} rows={2} value={store.description} onChange={(e) => setStore((st: any) => ({ ...st, description: e.target.value }))} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={s("رسوم التوصيل (د.ب)", "Delivery fee (BD)")}>
                  <input dir="ltr" type="number" step="0.01" className={inputCls} value={store.deliveryFee} onChange={(e) => setStore((st: any) => ({ ...st, deliveryFee: e.target.value }))} />
                </Field>
                <Field label={s("الحد الأدنى للطلب", "Minimum order")}>
                  <input dir="ltr" type="number" step="0.01" className={inputCls} value={store.minOrder} onChange={(e) => setStore((st: any) => ({ ...st, minOrder: e.target.value }))} />
                </Field>
                <Field label={s("خصم المطعم %", "Store discount %")}>
                  <input dir="ltr" type="number" className={inputCls} value={store.discountPercent} onChange={(e) => setStore((st: any) => ({ ...st, discountPercent: e.target.value }))} />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-royal-100 bg-white p-5 space-y-4">
              <h2 className="text-sm font-black text-royal-950">{s("الهوية البصرية — أزرار رفع مستقلة", "Visual identity — independent upload buttons")}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <ImageUpload label={s("لوقو المطعم", "Store logo")} value={store.logoUrl} onChange={(u) => setStore((st: any) => ({ ...st, logoUrl: u }))} />
                <ImageUpload label={s("صورة البانر", "Store banner")} value={store.bannerUrl} onChange={(u) => setStore((st: any) => ({ ...st, bannerUrl: u }))} />
              </div>
            </div>

            <Btn type="submit" disabled={busy} className="w-full">{busy ? <Spinner /> : s("حفظ الإعدادات", "Save settings")}</Btn>
          </form>
        )}
      </main>

      {/* reject modal */}
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title={s("رفض الطلب", "Reject order")}>
        <div className="space-y-3">
          <textarea className={inputCls} rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={s("سبب الرفض (إلزامي)", "Reason (required)")} />
          <Btn variant="danger" className="w-full" disabled={!rejectReason.trim()} onClick={async () => { await act(rejecting.id, "reject", { reason: rejectReason }); setRejecting(null); }}>
            {s("تأكيد الرفض", "Confirm rejection")}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

function OrderCard({ o, alert = false, children }: { o: any; alert?: boolean; children?: React.ReactNode }) {
  const { s } = useL();
  return (
    <div className={`rounded-2xl border bg-white p-4 ${alert ? "border-red-300 alert-ring" : "border-royal-100"}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-royal-950" dir="ltr">{o.orderNo}</p>
        <StatusBadge status={o.status} />
      </div>
      <p className="mt-1 text-[11px] text-gray-500">{o.customerName} · {s("العنوان", "Address")}: {o.address?.line || o.address?.area || "—"}</p>
      <div className="mt-2 space-y-1 rounded-xl bg-royal-50/60 p-2.5 text-xs">
        {(o.items || []).map((it: any, i: number) => (
          <div key={i} className="flex justify-between">
            <span className="font-bold text-royal-800">{it.nameAr || it.name} × {it.qty}</span>
            <span className="font-black">{fmtNum(it.lineTotal)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-black">
        <span className="text-royal-500">{o.paymentMethod === "cod" ? s("الدفع نقداً", "Cash on delivery") : o.paymentMethod}</span>
        <span>{fmtNum(o.total)}</span>
      </div>
      {children}
    </div>
  );
}
