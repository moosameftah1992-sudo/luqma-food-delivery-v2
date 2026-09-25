"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, FileSpreadsheet, FileText, TrendingUp, Store, Bike, Receipt, CircleSlash, Wallet, ArrowUpRight, Filter, RefreshCw } from "lucide-react";
import { Btn, Card, Empty, Spinner, Stat } from "@/components/ui";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/alert";
import { cn, fmtDateTime, fmtFils } from "@/lib/util";
import type { DriverReport, SalesReport, ReportGroup } from "@/lib/admin-reports";

type ReportSection = "sales" | "drivers";
type Filters = { from: string; to: string; group: ReportGroup; storeId: string; driverId: string };

function bahrainToday() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bahrain", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (key: string) => parts.find((part) => part.type === key)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function daysBefore(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
function createFilters(driverId?: number): Filters {
  const today = bahrainToday();
  return { from: today, to: today, group: "day", storeId: "all", driverId: driverId ? String(driverId) : "all" };
}
function reportParams(section: ReportSection, filters: Filters) {
  const params = new URLSearchParams({ section, from: filters.from, to: filters.to, group: filters.group });
  if (section === "sales" && filters.storeId !== "all") params.set("storeId", filters.storeId);
  if (section === "drivers" && filters.driverId !== "all") params.set("driverId", filters.driverId);
  return params;
}

function ReportToolbar({
  section, draft, setDraft, apply, loading, stores, drivers, fixedDriverId, exportReport, exporting,
}: {
  section: ReportSection;
  draft: Filters;
  setDraft: (next: Filters) => void;
  apply: () => void;
  loading: boolean;
  stores: SalesReport["stores"];
  drivers: DriverReport["drivers"];
  fixedDriverId?: number;
  exportReport: (format: "xlsx" | "pdf") => void;
  exporting: string | null;
}) {
  const { tr, locale } = useLocale();
  const field = "w-full rounded-xl border border-white/15 bg-[#1A0830] px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-[#FFC530] [color-scheme:dark]";
  const quick = (period: "today" | "week" | "month") => {
    const to = bahrainToday();
    const from = period === "today" ? to : daysBefore(to, period === "week" ? 6 : 29);
    setDraft({ ...draft, from, to, group: period === "month" ? "week" : "day" });
  };
  return <Card dark className="overflow-hidden p-0">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
      <div className="flex items-center gap-2 text-sm font-bold text-white"><Filter size={16} className="text-[#ffc531]" />{tr("فلترة التقرير", "Report filters")}</div>
      <div className="flex flex-wrap gap-1.5">
        {([ ["today", "اليوم", "Today"], ["week", "آخر ٧ أيام", "Last 7 days"], ["month", "آخر ٣٠ يوماً", "Last 30 days"] ] as const).map(([value, ar, en]) => <button key={value} type="button" onClick={() => quick(value)} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-bold text-white/65 transition hover:border-[#FFC530] hover:text-[#FFC530]">{tr(ar, en)}</button>)}
      </div>
    </div>
    <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
      <label className="space-y-1.5"><span className="text-[11px] font-bold text-white/55">{tr("من تاريخ", "From")}</span><input type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} className={field} aria-label={tr("من تاريخ", "From date")} /></label>
      <label className="space-y-1.5"><span className="text-[11px] font-bold text-white/55">{tr("إلى تاريخ", "To")}</span><input type="date" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} className={field} aria-label={tr("إلى تاريخ", "To date")} /></label>
      <label className="space-y-1.5"><span className="text-[11px] font-bold text-white/55">{tr("التجميع", "Group by")}</span><select value={draft.group} onChange={(event) => setDraft({ ...draft, group: event.target.value as ReportGroup })} className={field}><option value="day">{tr("يومي", "Daily")}</option><option value="week">{tr("أسبوعي", "Weekly")}</option><option value="month">{tr("شهري", "Monthly")}</option></select></label>
      {section === "sales" ? <label className="space-y-1.5"><span className="text-[11px] font-bold text-white/55">{tr("المطعم", "Restaurant")}</span><select value={draft.storeId} onChange={(event) => setDraft({ ...draft, storeId: event.target.value })} className={field}><option value="all">{tr("جميع المطاعم", "All restaurants")}</option>{stores.map((store) => <option key={store.id} value={store.id}>{locale === "en" ? store.nameEn || store.name : store.name}</option>)}</select></label>
        : <label className="space-y-1.5"><span className="text-[11px] font-bold text-white/55">{tr("المندوب", "Courier")}</span><select value={draft.driverId} disabled={Boolean(fixedDriverId)} onChange={(event) => setDraft({ ...draft, driverId: event.target.value })} className={field}><option value="all">{tr("جميع المندوبين", "All couriers")}</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label>}
    </div>
    <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-5 py-4">
      <Btn onClick={apply} disabled={loading || !draft.from || !draft.to || draft.from > draft.to} className="min-w-36"><RefreshCw size={15} className={loading ? "animate-spin" : ""} />{tr("عرض التقرير", "Apply filters")}</Btn>
      <button type="button" disabled={Boolean(exporting) || loading} onClick={() => exportReport("xlsx")} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/35 px-3 py-2.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-50"><FileSpreadsheet size={15} />{tr("تحميل Excel", "Download Excel")}</button>
      <button type="button" disabled={Boolean(exporting) || loading} onClick={() => exportReport("pdf")} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300/35 px-3 py-2.5 text-xs font-bold text-rose-200 transition hover:bg-rose-300/10 disabled:opacity-50"><FileText size={15} />{tr("تحميل PDF", "Download PDF")}</button>
      {exporting && <span className="text-xs text-[#FFC530]">{tr("جارٍ تجهيز الملف…", "Preparing file…")}</span>}
    </div>
  </Card>;
}

function useAdminReport<T>(section: ReportSection, fixedDriverId?: number) {
  const [draft, setDraft] = useState<Filters>(() => createFilters(fixedDriverId));
  const [applied, setApplied] = useState<Filters>(() => createFilters(fixedDriverId));
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const toast = useToast();
  const { show } = toast;
  const params = useMemo(() => reportParams(section, applied).toString(), [section, applied]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/analytics?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "تعذّر تحميل التقرير");
        if (!controller.signal.aborted) { setData(payload as T); setLoading(false); }
      }).catch((error) => {
        if (!controller.signal.aborted) { show(error instanceof Error ? error.message : "تعذّر تحميل التقرير", "err"); setLoading(false); }
      });
    return () => controller.abort();
  }, [params, show]);
  const apply = () => {
    if (!draft.from || !draft.to || draft.from > draft.to) return show("تأكد من صحة نطاق التواريخ", "err");
    setLoading(true);
    setApplied({ ...draft });
  };
  const exportReport = async (format: "xlsx" | "pdf") => {
    if (exporting) return;
    setExporting(format);
    try {
      const response = await fetch(`/api/admin/analytics/export?${params}&format=${format}`, { cache: "no-store" });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "تعذّر تحميل الملف");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `luqma-${section}-${applied.from}-to-${applied.to}.${format}`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) { show(error instanceof Error ? error.message : "تعذّر تصدير التقرير", "err"); }
    finally { setExporting(null); }
  };
  return { draft, setDraft, applied, data, loading, exporting, apply, exportReport, toast };
}

export function SalesAnalytics({ context = "overview" }: { context?: "overview" | "finance" }) {
  const { tr } = useLocale();
  const report = useAdminReport<SalesReport>("sales");
  const data = report.data;
  const [expanded, setExpanded] = useState<number | null>(null);
  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.19em] text-[#ffc531]">{context === "finance" ? "FINANCIAL INTELLIGENCE" : "SALES INTELLIGENCE"}</p><h2 className="mt-1 font-display text-2xl font-extrabold text-white">{tr(context === "finance" ? "مبيعات التطبيق والمطاعم" : "المبيعات لحظة بلحظة", context === "finance" ? "Platform & restaurant sales" : "Sales performance")}</h2><p className="mt-1 text-xs text-white/50">{tr("الوضع الافتراضي: مبيعات اليوم · توقيت البحرين. الأرقام للطلبات المسلّمة والمدفوعة فقط.", "Default: today's sales · Bahrain time. Only delivered, paid orders count as sales.")}</p></div><span className="rounded-full border border-[#ffc531]/30 bg-[#ffc531]/10 px-3 py-1 text-xs font-bold text-[#ffc531]">{report.applied.from} — {report.applied.to}</span></div>
    <ReportToolbar section="sales" draft={report.draft} setDraft={report.setDraft} apply={report.apply} loading={report.loading} stores={data?.stores ?? []} drivers={[]} exportReport={report.exportReport} exporting={report.exporting} />
    {report.loading ? <Spinner label={tr("جاري حساب المبيعات…", "Calculating sales…")} /> : data ? <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><Stat dark label={tr("إجمالي المبيعات", "Total sales")} value={fmtFils(data.totals.salesFils)} accent /><Stat dark label={tr("مبيعات الطعام", "Food sales")} value={fmtFils(data.totals.foodSalesFils)} /><Stat dark label={tr("رسوم التوصيل", "Delivery fees")} value={fmtFils(data.totals.deliveryFeesFils)} /><Stat dark label={tr("إيراد لقمة", "Platform revenue")} value={fmtFils(data.totals.platformRevenueFils)} /><Stat dark label={tr("طلبات مكتملة", "Completed orders")} value={String(data.totals.orders)} /><Stat dark label={tr("طلبات ملغاة", "Cancelled orders")} value={String(data.totals.cancellations)} /></div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#291047]"><div className="flex items-center gap-2 border-b border-white/10 px-5 py-4 font-bold text-white"><Store size={17} className="text-[#ffc531]" />{tr("مبيعات كل مطعم على حدة", "Sales by restaurant")}</div><div className="max-h-[360px] overflow-auto"><table className="min-w-[660px] w-full text-right text-xs"><thead className="sticky top-0 bg-[#321451] text-[#ffc531]"><tr><th className="px-4 py-3">{tr("المطعم", "Restaurant")}</th><th className="px-3 py-3">{tr("طلبات", "Orders")}</th><th className="px-3 py-3">{tr("الطعام", "Food")}</th><th className="px-3 py-3">{tr("الخصومات", "Discounts")}</th><th className="px-3 py-3">{tr("التوصيل", "Delivery")}</th><th className="px-3 py-3">{tr("عمولة لقمة", "Luqma fee")}</th><th className="px-3 py-3">{tr("صافي المتجر", "Store net")}</th></tr></thead><tbody className="divide-y divide-white/8 text-white/80">{data.breakdown.map((r) => <tr key={r.storeId} className="hover:bg-white/5"><td className="px-4 py-3 font-bold text-white">{r.name}</td><td className="px-3 py-3 tabular-nums">{r.orders}</td><td className="px-3 py-3 tabular-nums">{fmtFils(r.foodSalesFils)}</td><td className="px-3 py-3 tabular-nums">{fmtFils(r.discountFils)}</td><td className="px-3 py-3 tabular-nums">{fmtFils(r.deliveryFeesFils)}</td><td className="px-3 py-3 tabular-nums text-[#ffc531]">{fmtFils(r.storeCommissionFils)}</td><td className="px-3 py-3 tabular-nums font-bold">{fmtFils(r.storeNetFils)}</td></tr>)}</tbody></table>{!data.breakdown.length && <Empty dark text={tr("لا توجد مطاعم", "No restaurants")} />}</div></div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#291047]"><div className="flex items-center gap-2 border-b border-white/10 px-5 py-4 font-bold text-white"><TrendingUp size={17} className="text-[#ffc531]" />{tr("حركة المبيعات حسب الفترة", "Sales by period")}</div><div className="max-h-[360px] overflow-auto p-4"><div className="space-y-3">{data.timeline.map((r) => { const max = Math.max(1, ...data.timeline.map((item) => item.salesFils)); return <div key={r.period}><div className="mb-1 flex items-center justify-between gap-2 text-xs text-white/65"><span className="tabular-nums">{r.period}</span><span className="font-bold tabular-nums text-[#ffc531]">{fmtFils(r.salesFils)}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-l from-[#ffc531] to-[#ff7919]" style={{ width: `${Math.max(4, r.salesFils / max * 100)}%` }} /></div><p className="mt-1 text-[10px] text-white/40">{r.orders} {tr("طلبات", "orders")}</p></div>; })}</div>{!data.timeline.length && <Empty dark text={tr("لا توجد مبيعات لهذه الفترة", "No sales for this period")} />}</div></div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#291047]"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-4"><div className="flex items-center gap-2 font-bold text-white"><CircleSlash size={17} className="text-rose-300" />{tr("سجل الطلبات الملغاة والمرفوضة", "Cancelled & rejected order log")}</div><span className="rounded-full bg-rose-300/10 px-2.5 py-1 text-xs font-bold text-rose-200">{data.cancellations.length}</span></div><div className="max-h-[530px] overflow-auto p-4">{data.cancellations.length ? <div className="space-y-2">{data.cancellations.map((r) => <div key={r.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#1e0b36]"><button type="button" onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-start"><span className="flex flex-wrap items-center gap-3"><span className="font-mono text-xs font-bold text-[#ffc531]" dir="ltr">{r.code}</span><span className="text-xs font-bold text-white">{r.storeName}</span><span className="text-xs text-white/70">{r.customerName}</span><span className="text-[11px] text-rose-300">{r.statusLabel}</span></span><span className="text-xs text-white/50">{fmtDateTime(r.placedAt)} · {fmtFils(r.totalFils)}</span></button>{expanded === r.id && <div className="grid gap-3 border-t border-white/10 px-4 py-4 text-xs text-white/75 sm:grid-cols-2"><div><span className="text-white/40">{tr("السبب", "Reason")}: </span>{r.reason}</div><div><span className="text-white/40">{tr("أُلغي بواسطة", "Cancelled by")}: </span>{r.cancelledBy}</div><div><span className="text-white/40">{tr("اسم العميل والهاتف", "Customer & phone")}: </span>{r.customerName} · {r.customerPhone || "—"}</div><div><span className="text-white/40">{tr("حالة الدفع", "Payment status")}: </span>{r.paymentStatus}</div><div className="sm:col-span-2"><span className="text-white/40">{tr("عنوان التوصيل", "Delivery address")}: </span>{r.address || "—"}</div><div className="sm:col-span-2"><span className="text-white/40">{tr("تفاصيل الأصناف", "Order items")}: </span>{r.items.join(" · ") || "—"}</div><div className="font-bold text-[#ffc531] sm:col-span-2">{tr("القيمة", "Order value")}: {fmtFils(r.totalFils)}</div></div>}</div>)}</div> : <Empty dark text={tr("لا توجد طلبات ملغاة خلال هذه الفترة", "No cancelled orders in this period")} />}</div></div>
      <p className="text-xs leading-6 text-white/40">{tr("التقرير يحسب المبيعات من الطلبات المسلّمة والمدفوعة إلكترونياً فقط؛ الطلبات الملغاة تظهر في سجل مستقل ولا تضاف إلى المبيعات.", "Sales include only delivered, confirmed digital payments. Cancellations are logged separately and excluded from revenue.")}</p>
    </> : null}{report.toast.node}
  </section>;
}

export function DriverAnalytics({ fixedDriverId }: { fixedDriverId?: number }) {
  const { tr } = useLocale();
  const report = useAdminReport<DriverReport>("drivers", fixedDriverId);
  const data = report.data;
  return <section className="space-y-5"><div><p className="text-xs font-extrabold uppercase tracking-[.19em] text-[#ffc531]">COURIER LEDGER</p><h2 className="mt-1 font-display text-2xl font-extrabold text-white">{tr(fixedDriverId ? "تقرير المندوب" : "تقارير المندوبين", fixedDriverId ? "Courier report" : "Courier reports")}</h2><p className="mt-1 text-xs text-white/50">{tr("رسوم كل توصيل، ثم عمولة لقمة، ثم الصافي. تصفية وتصدير حسب الفترة.", "Each delivery fee, minus Luqma commission, equals the courier's net. Filter and export any period.")}</p></div>
    <ReportToolbar section="drivers" draft={report.draft} setDraft={report.setDraft} apply={report.apply} loading={report.loading} stores={[]} drivers={data?.drivers ?? []} fixedDriverId={fixedDriverId} exportReport={report.exportReport} exporting={report.exporting} />
    {report.loading ? <Spinner label={tr("جارٍ حساب المستحقات…", "Calculating earnings…")} /> : data ? <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><Stat dark label={tr("طلبات مكتملة", "Completed deliveries")} value={String(data.totals.completed)} /><Stat dark label={tr("رسوم التوصيل", "Delivery fees")} value={fmtFils(data.totals.deliveryFeesFils)} /><Stat dark label={tr("عمولة المنصة", "Platform commission")} value={fmtFils(data.totals.commissionFils)} accent /><Stat dark label={tr("صافي المستحق", "Net earned")} value={fmtFils(data.totals.netFils)} /><Stat dark label={tr("المدفوع", "Paid in period")} value={fmtFils(data.totals.paidFils)} /><Stat dark label={tr("فرق الفترة", "Period difference")} value={fmtFils(data.totals.remainingFils)} /></div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#291047]"><div className="flex items-center gap-2 border-b border-white/10 px-5 py-4 font-bold text-white"><Bike size={17} className="text-[#ffc531]" />{tr("مستحقات كل مندوب", "Earnings by courier")}</div><div className="max-h-80 overflow-auto"><table className="w-full min-w-[640px] text-right text-xs"><thead className="sticky top-0 bg-[#321451] text-[#ffc531]"><tr><th className="px-4 py-3">{tr("المندوب", "Courier")}</th><th className="px-3 py-3">{tr("الطلبات", "Deliveries")}</th><th className="px-3 py-3">{tr("رسوم التوصيل", "Delivery fees")}</th><th className="px-3 py-3">{tr("عمولة المنصة", "Platform cut")}</th><th className="px-3 py-3">{tr("الصافي", "Net earned")}</th><th className="px-3 py-3">{tr("المدفوع", "Paid")}</th></tr></thead><tbody className="divide-y divide-white/8 text-white/75">{data.breakdown.map((r) => <tr key={r.driverId}><td className="px-4 py-3 font-bold text-white">{r.name}</td><td className="px-3 py-3">{r.completed}</td><td className="px-3 py-3 tabular-nums">{fmtFils(r.deliveryFeesFils)}</td><td className="px-3 py-3 tabular-nums text-[#ffc531]">{fmtFils(r.commissionFils)}</td><td className="px-3 py-3 tabular-nums font-bold">{fmtFils(r.netFils)}</td><td className="px-3 py-3 tabular-nums">{fmtFils(r.paidFils)}</td></tr>)}</tbody></table>{!data.breakdown.length && <Empty dark text={tr("لا يوجد مندوبون", "No couriers")} />}</div></div>
      <div className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-[#291047] p-5"><h3 className="mb-4 flex items-center gap-2 font-bold text-white"><CalendarDays size={17} className="text-[#ffc531]" />{tr("ملخص يومي / أسبوعي / شهري", "Daily / weekly / monthly summary")}</h3>{data.timeline.length ? <div className="space-y-2">{data.timeline.map((r) => <div key={r.period} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-xs"><span className="text-white/75">{r.period} · {r.completed} {tr("طلبات", "orders")}</span><span className="font-bold tabular-nums text-[#ffc531]">{fmtFils(r.deliveryFeesFils)} − {fmtFils(r.commissionFils)} = {fmtFils(r.netFils)}</span></div>)}</div> : <Empty dark text={tr("لا توجد توصيلات", "No deliveries")} />}</div><div className="rounded-2xl border border-white/10 bg-[#291047] p-5"><h3 className="mb-4 flex items-center gap-2 font-bold text-white"><Wallet size={17} className="text-[#ffc531]" />{tr("المدفوعات خلال الفترة", "Payouts in period")}</h3>{data.payouts.length ? <div className="max-h-64 space-y-2 overflow-auto">{data.payouts.map((r) => <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-xs"><span className="text-white/65">{r.driverName} · {fmtDateTime(r.createdAt)} · {r.note}</span><span className="shrink-0 font-bold text-emerald-300">{fmtFils(r.amountFils)}</span></div>)}</div> : <Empty dark text={tr("لا توجد دفعات مسجلة", "No payouts recorded")} />}</div></div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#291047]"><h3 className="flex items-center gap-2 border-b border-white/10 px-5 py-4 font-bold text-white"><Receipt size={17} className="text-[#ffc531]" />{tr("تفاصيل كل طلب مكتمل", "Individual completed deliveries")}</h3><div className="max-h-[450px] overflow-auto"><table className="w-full min-w-[720px] text-right text-xs"><thead className="sticky top-0 bg-[#321451] text-[#ffc531]"><tr><th className="px-4 py-3">{tr("الطلب", "Order")}</th><th className="px-3 py-3">{tr("التاريخ", "Date")}</th><th className="px-3 py-3">{tr("المندوب", "Courier")}</th><th className="px-3 py-3">{tr("المطعم", "Restaurant")}</th><th className="px-3 py-3">{tr("رسوم التوصيل", "Delivery fee")}</th><th className="px-3 py-3">{tr("عمولة المنصة", "Commission")}</th><th className="px-3 py-3">{tr("الصافي", "Net")}</th></tr></thead><tbody className="divide-y divide-white/8 text-white/75">{data.orders.map((r) => <tr key={r.id}><td className="px-4 py-3 font-mono text-white" dir="ltr">{r.code}</td><td className="px-3 py-3 whitespace-nowrap">{fmtDateTime(r.placedAt)}</td><td className="px-3 py-3">{r.driverName}</td><td className="px-3 py-3">{r.storeName}</td><td className="px-3 py-3 tabular-nums">{fmtFils(r.deliveryFeesFils)}</td><td className="px-3 py-3 tabular-nums text-[#ffc531]">{r.commissionPct}% · {fmtFils(r.commissionFils)}</td><td className="px-3 py-3 tabular-nums font-bold text-white">{fmtFils(r.netFils)}</td></tr>)}</tbody></table>{!data.orders.length && <Empty dark text={tr("لا توجد توصيلات في الفترة المختارة", "No deliveries in the selected period")} />}</div></div>
    </> : null}{report.toast.node}
  </section>;
}

export function FinanceReportCenter() {
  const { tr } = useLocale();
  const [view, setView] = useState<"sales" | "drivers">("sales");
  return <div className="space-y-6"><div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ffc531]">FINANCE CONTROL</p><h1 className="mt-1 font-display text-3xl font-extrabold text-white">{tr("المالية والتقارير", "Finance & reports")}</h1><p className="mt-1 text-sm text-white/50">{tr("من بيانات الطلبات الفعلية، مع تحميل Excel وPDF لكل نطاق زمني.", "Real order data, with Excel and PDF downloads for every date range.")}</p></div><div className="inline-flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1"><button onClick={() => setView("sales")} className={cn("rounded-lg px-5 py-2.5 text-sm font-bold transition", view === "sales" ? "bg-[#ffc531] text-[#281044]" : "text-white/65 hover:text-white")}>{tr("مبيعات المطاعم", "Restaurant sales")}</button><button onClick={() => setView("drivers")} className={cn("rounded-lg px-5 py-2.5 text-sm font-bold transition", view === "drivers" ? "bg-[#ffc531] text-[#281044]" : "text-white/65 hover:text-white")}>{tr("تقارير المندوبين", "Courier reports")}</button></div>{view === "sales" ? <SalesAnalytics context="finance" /> : <DriverAnalytics />}</div>;
}
