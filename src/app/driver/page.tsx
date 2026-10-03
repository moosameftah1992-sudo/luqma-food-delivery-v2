"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, Badge, Field, inputCls, Logo, LangToggle, Spinner, Empty, Modal, useAudioAlert, downloadCSV, StatusBadge } from "@/components/ui";
import { useL, fmtNum, fmtDate } from "@/lib/i18n";

export default function DriverDashboard() {
  const router = useRouter();
  const { s, lang } = useL();
  const [me, setMe] = useState<any>(null);
  const [broadcast, setBroadcast] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [cancelModal, setCancelModal] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [from, setFrom] = useState(new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [ledger, setLedger] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const openCount = broadcast.length;
  useAudioAlert(me?.isOnline && openCount > 0, "pulse", soundOn);

  const load = useCallback(async () => {
    const r = await fetch("/api/drivers");
    if (r.status === 401) {
      router.replace("/partner/driver");
      return;
    }
    const j = await r.json();
    setMe(j.me);
    setBroadcast(j.broadcast || []);
    setMine(j.mine || []);
  }, [router]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const toggleOnline = async () => {
    await fetch("/api/drivers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle-online" }) });
    load();
  };

  const accept = async (id: number) => {
    setErr("");
    setInfo("");
    const r = await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "driver-accept" }) });
    const j = await r.json();
    if (j.error) setErr(j.error);
    else setInfo(s("مبروك! تم قبول الطلب — توجه للمطعم", "Order accepted — head to the restaurant"));
    load();
  };

  const deliver = async (id: number) => {
    await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deliver" }) });
    load();
  };

  const cancelAccepted = async () => {
    setBusy(true);
    const r = await fetch(`/api/orders/${cancelModal.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "driver-cancel", reason: cancelReason }) });
    const j = await r.json();
    if (j.error) setErr(j.error);
    setCancelModal(null);
    setCancelReason("");
    setBusy(false);
    load();
  };

  const loadLedger = async () => {
    const r = await fetch(`/api/drivers?action=ledger&from=${from}&to=${to}`);
    if (r.ok) setLedger(await r.json());
  };

  const logout = async () => {
    await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout", role: "driver" }) });
    router.push("/");
  };

  if (!me) return <div className="grid min-h-screen place-items-center bg-royal-950"><Spinner light /></div>;

  const exportLedgerCSV = () => {
    if (!ledger) return;
    downloadCSV(
      `luqma-driver-ledger-${from}-to-${to}.csv`,
      [s("الطلب", "Order"), s("التاريخ", "Date"), s("رسوم التوصيل", "Delivery fee"), s("عمولة المنصة", "Commission"), s("صافي الأجر", "Net"), s("العنوان", "Address")],
      ledger.lines.map((l: any) => [l.orderNo, fmtDate(l.date, lang), l.deliveryFee, l.commission, l.net, l.address])
    );
  };

  return (
    <div className="min-h-screen bg-royal-50">
      <header className="no-print sticky top-0 z-40 bg-royal-950 text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo size={38} />
            <div>
              <p className="text-sm font-black">{me.name}</p>
              <p className="text-[10px] text-white/50">{s("لوحة المندوب", "Driver dashboard")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundOn((v) => !v)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-black border transition ${soundOn ? "bg-gold-500 text-royal-950 border-gold-500" : "border-white/25 text-white/60"}`}
            >
              {soundOn ? s("تنبيهات صوتية", "Audio alerts") : s("صامت", "Muted")}
            </button>
            <LangToggle />
            <button onClick={logout} className="rounded-full border border-white/25 px-3 py-1.5 text-[11px] font-black hover:bg-white/10">{s("خروج", "Logout")}</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* online switch */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-l from-royal-900 to-royal-800 p-5 text-white shadow-lg">
          <div>
            <p className="text-xs font-bold text-white/60">{s("الحالة المباشرة", "Live status")}</p>
            <p className="text-xl font-black">
              {me.isOnline ? (
                <span className="text-emerald-400">● {s("متصل — تستقبل الطلبات", "Online — receiving orders")}</span>
              ) : (
                <span className="text-white/60">○ {s("غير متصل", "Offline")}</span>
              )}
            </p>
          </div>
          <button
            onClick={toggleOnline}
            className={`relative h-9 w-16 rounded-full transition ${me.isOnline ? "bg-emerald-500" : "bg-white/20"}`}
          >
            <span className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all ${me.isOnline ? "start-8" : "start-1"}`} />
          </button>
        </div>

        {err && <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-600">{err}</div>}
        {info && <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700">{info}</div>}

        {/* broadcast */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-royal-950">
            {s("طلبات متاحة الآن", "Available orders (broadcast)")}
            {me.isOnline && openCount > 0 && (
              <span className="alert-ring flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black text-white">
                {openCount} — {s("تنبيه صوتي كل دقيقة (5 ثوان)", "5s alert every minute")}
              </span>
            )}
          </h2>
          {!me.isOnline ? (
            <Empty text={s("فعّل حالتك (متصل) لاستقبال الطلبات الجديدة فوراً", "Turn ON to start receiving orders instantly")} />
          ) : broadcast.length === 0 ? (
            <Empty text={s("لا توجد طلبات جاهزة حالياً — سننبهك فور ظهور أي طلب", "No ready orders right now — you'll be alerted the moment one appears")} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {broadcast.map((o) => (
                <div key={o.id} className="rounded-2xl border-2 border-gold-400 bg-white p-4 shadow-lg shadow-gold-500/10">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-royal-950">{o.store?.nameAr || s("مطعم", "Restaurant")}</p>
                    <Badge tone="gold">{s("جديد", "New")}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs font-bold text-gray-600">
                    <span className="text-royal-400">{s("التوصيل إلى", "Deliver to")}:</span> {o.address?.line || o.address?.area || "—"}
                  </p>
                  <p className="text-[11px] text-gray-400">{o.address?.governorate} {o.address?.area}</p>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-royal-50 px-3 py-2 text-xs font-black text-royal-800">
                    <span>{s("رسوم التوصيل لك", "Your fee")}: <span className="text-gold-600">{fmtNum(o.deliveryFee)}</span></span>
                    <span>{fmtDate(o.readyAt || o.placedAt, lang)}</span>
                  </div>
                  <Btn className="mt-3 w-full" onClick={() => accept(o.id)}>{s("قبول الطلب (الأول بالأول)", "Accept order (first come, first served)")}</Btn>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* my active */}
        {mine.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-black text-royal-950">{s("طلباتك النشطة", "Your active orders")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {mine.map((o) => (
                <div key={o.id} className="rounded-2xl border border-royal-100 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-royal-950" dir="ltr">{o.orderNo}</p>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 text-xs font-bold text-gray-600">{o.store?.nameAr}</p>
                  <p className="text-xs text-gray-500">{o.address?.line || o.address?.area || "—"}</p>
                  <div className="mt-3 flex gap-2">
                    {o.status === "out_for_delivery" && <Btn className="flex-1" onClick={() => deliver(o.id)}>{s("تم التسليم ✓", "Delivered ✓")}</Btn>}
                    <Btn variant="danger" onClick={() => { setCancelModal(o); setCancelReason(""); }}>{s("إلغاء", "Cancel")}</Btn>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ledger */}
        <section className="no-print">
          <h2 className="mb-3 text-sm font-black text-royal-950">{s("دفتر الأرباح", "Earnings ledger")}</h2>
          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-royal-100 bg-white p-4">
            <Field label={s("من تاريخ", "From")}>
              <input type="date" dir="ltr" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={s("إلى تاريخ", "To")}>
              <input type="date" dir="ltr" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Btn onClick={loadLedger} className="mb-0.5">{s("عرض", "Show")}</Btn>
            <div className="ms-auto flex gap-2">
              <Btn variant="outline" onClick={exportLedgerCSV} disabled={!ledger?.lines?.length}>{s("تصدير Excel", "Export Excel")}</Btn>
              <Btn variant="outline" onClick={() => window.print()} disabled={!ledger?.lines?.length}>{s("تصدير PDF", "Export PDF")}</Btn>
            </div>
          </div>
          {ledger && (
            <div className="print-block mt-3 overflow-x-auto rounded-2xl border border-royal-100 bg-white">
              <table className="w-full text-xs">
                <thead className="bg-royal-50 text-royal-600">
                  <tr>{[s("الطلب", "Order"), s("التاريخ", "Date"), s("رسوم التوصيل", "Fee"), s("عمولة المنصة (10%)", "Commission"), s("صافي الأجر", "Net"), s("العنوان", "Address")].map((h) => <th key={h} className="px-3 py-2.5 text-start font-black">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {ledger.lines.map((l: any) => (
                    <tr key={l.orderNo} className="border-t border-royal-50">
                      <td className="px-3 py-2 font-black" dir="ltr">{l.orderNo}</td>
                      <td className="px-3 py-2 text-gray-500">{fmtDate(l.date, lang)}</td>
                      <td className="px-3 py-2">{fmtNum(l.deliveryFee)}</td>
                      <td className="px-3 py-2 text-red-500">−{fmtNum(l.commission)}</td>
                      <td className="px-3 py-2 font-black text-emerald-600">{fmtNum(l.net)}</td>
                      <td className="px-3 py-2 text-gray-500">{l.address}</td>
                    </tr>
                  ))}
                  {ledger.lines.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center font-bold text-gray-400">{s("لا توجد طلبات مكتملة في هذه الفترة", "No completed orders in this range")}</td></tr>}
                </tbody>
                {ledger.lines.length > 0 && (
                  <tfoot className="border-t-2 border-royal-100 bg-gold-100/40 font-black text-royal-900">
                    <tr>
                      <td className="px-3 py-2.5" colSpan={2}>{s("المجموع", "Total")} ({ledger.totals.count})</td>
                      <td className="px-3 py-2.5">{fmtNum(ledger.totals.fees)}</td>
                      <td className="px-3 py-2.5 text-red-600">−{fmtNum(ledger.totals.commission)}</td>
                      <td className="px-3 py-2.5">{fmtNum(ledger.totals.net)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>
      </main>

      <Modal open={!!cancelModal} onClose={() => setCancelModal(null)} title={s("إلغاء الطلب", "Cancel order")}>
        <div className="space-y-3">
          <p className="text-xs text-gray-500">{s("سيُعاد الطلب للبث لجميع المندوبين المتصلين. السبب إلزامي.", "The order will be re-broadcast to online drivers. Reason is required.")}</p>
          <textarea className={inputCls} rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder={s("سبب الإلغاء (إلزامي)", "Reason (required)")} />
          <Btn variant="danger" className="w-full" disabled={busy || !cancelReason.trim()} onClick={cancelAccepted}>{busy ? <Spinner /> : s("تأكيد الإلغاء", "Confirm cancellation")}</Btn>
        </div>
      </Modal>
    </div>
  );
}
