"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SoundSwitch, useLiveList, useToast, AlertFlash } from "@/components/alert";
import { Btn, Card, ConsoleShell, Empty, Field, Modal, Pill, Price, Spinner, Stat, darkInputCls, inputCls, Tabs, Label } from "@/components/ui";
import { PERMISSIONS as PERM_CATALOG } from "@/lib/auth-client";
import { LocationsManager } from "@/components/admin-locations";
import { AdminStoreOnboarding } from "@/components/admin-store-onboarding";
import { AdminStoreOperations } from "@/components/admin-store-operations";
import { DriverAnalytics, FinanceReportCenter, SalesAnalytics } from "@/components/admin-reports";
import { AdminStoreMenu } from "@/components/admin-store-menu";
import { AdminCustomerTools } from "@/components/admin-customer-tools";
import { AdminPaymentMethods } from "@/components/admin-payment-methods";

const PERMISSIONS = PERM_CATALOG as { key: string; label: string }[];
import { cn, fmtDate, fmtDateTime, fmtFils, num, ORDER_STATUS_AR } from "@/lib/util";
import type { Brand } from "@/lib/brand";

const NAV = [
  { key: "overview", label: "نظرة عامة", icon: "📈" },
  { key: "stores", label: "المتاجر", icon: "🍽" },
  { key: "drivers", label: "المندوبون", icon: "🛵" },
  { key: "customers", label: "العملاء", icon: "👥" },
  { key: "locations", label: "المناطق", icon: "🗺" },
  { key: "requests", label: "الأسعار", icon: "💱" },
  { key: "finance", label: "المالية", icon: "💰" },
  { key: "payments", label: "وسائل الدفع", icon: "💳" },
  { key: "admins", label: "المديرون", icon: "🛡" },
  { key: "cms", label: "المحتوى", icon: "🎨" },
];

type V = string | number | boolean | string[] | null | undefined;
type Row = Record<string, V>;

export function AdminDashboard({
  brand,
  logoOverride,
  perms,
  adminName,
}: {
  brand: Brand;
  logoOverride?: string;
  perms: string[];
  adminName: string;
}) {
  const [tab, setTab] = useState("overview");
  const toast = useToast();
  const allowed = (p: string) => perms.includes("all") || perms.includes(p);

  const logout = async () => {
    await fetch("/api/auth/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  const nav = NAV.filter((n) =>
    n.key === "cms"
      ? allowed("cms")
      : n.key === "overview"
        ? allowed("finance") || allowed("operations") || allowed("users")
      : n.key === "finance" || n.key === "payments"
        ? allowed("finance")
        : n.key === "admins"
          ? perms.includes("all")
          : n.key === "locations" || n.key === "requests"
            ? allowed("operations") || allowed("all")
            : allowed("users") || allowed("operations") || allowed("all"),
  );

  return (
    <ConsoleShell
      brand={brand}
      logoOverride={logoOverride}
      nav={nav.length ? nav : NAV}
      active={tab}
      onNav={setTab}
      user={`${adminName} · تحكّم شامل`}
      onLogout={logout}
      right={
        <>
          <SoundSwitch />
          <Link
            href="/"
            className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-white/70 hover:border-[#FDBA21] hover:text-[#FDBA21]"
          >
            معاينة تطبيق العميل
          </Link>
        </>
      }
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {tab === "overview" && <Overview />}
        {tab === "stores" && <EntityTable resource="stores" title="إدارة المتاجر" toast={toast.show} />}
        {tab === "drivers" && <EntityTable resource="drivers" title="إدارة مندوبي التوصيل" toast={toast.show} />}
        {tab === "customers" && <EntityTable resource="customers" title="إدارة العملاء" toast={toast.show} />}
        {tab === "locations" && <LocationsManager toast={toast.show} />}
        {tab === "requests" && <Requests toast={toast.show} />}
        {tab === "finance" && <FinanceReportCenter />}
        {tab === "payments" && <AdminPaymentMethods />}
        {tab === "admins" && <Admins toast={toast.show} />}
        {tab === "cms" && <Cms toast={toast.show} brand={brand} />}
      </div>
      {toast.node}
    </ConsoleShell>
  );
}

function Overview() {
  const [data, setData] = useState<{
    counts: Record<string, number>;
    money: Record<string, number>;
  } | null>(null);
  const [cancelFor, setCancelFor] = useState<{ id: number; code: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const cancelToast = useToast();
  const { items: live, flash, refresh } = useLiveList<Row & { id: number }>(
    "/api/orders?scope=admin",
    6000,
    { silent: false },
  );
  const cancelCurrentOrder = async () => {
    if (!cancelFor || cancelReason.trim().length < 3 || cancelling) return;
    setCancelling(true);
    try {
      const response = await fetch(`/api/orders/${cancelFor.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel", reason: cancelReason.trim() }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر إلغاء الطلب");
      setCancelFor(null);
      setCancelReason("");
      cancelToast.show("تم إلغاء الطلب مع تسجيل السبب");
      await refresh();
    } catch (error) { cancelToast.show(error instanceof Error ? error.message : "تعذر إلغاء الطلب", "err"); }
    finally { setCancelling(false); }
  };

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/overview");
      if (res.ok) setData(await res.json());
    })();
  }, [live.length]);

  return (
    <div className={cn(flash && "edge-glow rounded-2xl")}>
      {flash && (
        <AlertFlash
          title={`طلب جديد ${flash.code}`}
          subtitle={`${ORDER_STATUS_AR[String(flash.status)] ?? ""} — ${fmtFils(num(flash.totalFils))}`}
          onDismiss={() => {}}
        />
      )}
      <Label>مركز التحكم</Label>
      <h1 className="mb-7 font-display text-3xl font-extrabold text-white">نظرة عامة على المنصّة</h1>
      <SalesAnalytics />

      {!data ? (
        <Spinner />
      ) : (
        <>
          <h2 className="mb-3 mt-9 font-display text-xl font-extrabold text-white">مؤشرات التشغيل العامة</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat dark label="المتاجر" value={String(data.counts.stores)} sub={`${data.counts.pendingStores} بانتظار التفعيل`} />
            <Stat dark label="المندوبون" value={String(data.counts.drivers)} sub={`${data.counts.pendingDrivers} بانتظار المراجعة`} />
            <Stat dark label="العملاء" value={String(data.counts.customers)} />
            <Stat dark label="طلبات جديدة" value={String(data.counts.pending)} accent />
          </div>

          <h2 className="mt-8 mb-3 font-display text-xl font-extrabold text-[#FDBA21]">آخر الطلبات</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead className="bg-white/5 text-[11px] uppercase tracking-[0.16em] text-[#FDBA21]">
                <tr>
                  <th className="px-4 py-3">الطلب</th>
                  <th className="px-4 py-3">المتجر</th>
                  <th className="px-4 py-3">العميل</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">الإجمالي</th>
                  <th className="px-4 py-3">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-white/85">
                {live.slice(0, 8).map((o) => (
                  <tr key={String(o.id)}>
                    <td className="px-4 py-3 tabular-nums">{String(o.code)}</td>
                    <td className="px-4 py-3">{String(o.storeName ?? "")}</td>
                    <td className="px-4 py-3">{String(o.customerName ?? "")}</td>
                    <td className="px-4 py-3 text-[#FDBA21]">
                      {ORDER_STATUS_AR[String(o.status)] ?? String(o.status)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{fmtFils(num(o.totalFils))}</td>
                    <td className="px-4 py-3">{["pending", "accepted", "ready", "assigned", "onway"].includes(String(o.status)) && ["captured", "cash_due"].includes(String(o.paymentStatus)) && <button type="button" onClick={() => { setCancelFor({ id: o.id, code: String(o.code) }); setCancelReason(""); }} className="rounded-lg border border-rose-400/40 px-2.5 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-400/10">إلغاء مع سبب</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Modal open={!!cancelFor} onClose={() => setCancelFor(null)} title={`إلغاء الطلب ${cancelFor?.code ?? ""}`}>
        <div className="space-y-4">
          <p className="text-sm text-[#6B5E7A]">الإلغاء يتطلب سبباً واضحاً. يُطلب استرداد الدفعة الإلكترونية ويُعاد رصيد البونس إن استُخدم.</p>
          <Field label="سبب الإلغاء (إلزامي)">
            <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} required minLength={3} maxLength={400} rows={3} className={inputCls} placeholder="اكتب سبب الإلغاء…" />
          </Field>
          <Btn variant="danger" disabled={cancelling || cancelReason.trim().length < 3} onClick={() => void cancelCurrentOrder()} className="w-full">{cancelling ? "جارٍ الإلغاء…" : "تأكيد الإلغاء"}</Btn>
        </div>
      </Modal>
      {cancelToast.node}
    </div>
  );
}

const ENTITY_META: Record<
  string,
  {
    title: string;
    cols: { key: string; label: string }[];
    actions: { label: string; patch: Row; tone?: string }[];
  }
> = {
  stores: {
    title: "إدارة المتاجر",
    cols: [
      { key: "nameAr", label: "المتجر" },
      { key: "email", label: "البريد" },
      { key: "cuisine", label: "المطبخ" },
      { key: "status", label: "الحالة" },
      { key: "commissionFils", label: "العمولة" },
    ],
    actions: [
      { label: "تفعيل", patch: { approved: true, banned: false } },
      { label: "إيقاف", patch: { banned: true } },
    ],
  },
  drivers: {
    title: "إدارة مندوبي التوصيل",
    cols: [
      { key: "name", label: "المندوب" },
      { key: "email", label: "البريد" },
      { key: "idCardNumber", label: "الهوية" },
      { key: "licenseNumber", label: "الرخصة" },
      { key: "status", label: "الحالة" },
      { key: "commissionPct", label: "عمولة المنصّة %" },
      { key: "completedOrders", label: "مكتملة" },
      { key: "deliveryFeesFils", label: "رسوم التوصيل" },
      { key: "platformCommissionFils", label: "خصم المنصة" },
      { key: "driverNetFils", label: "الصافي" },
    ],
    actions: [
      { label: "إيقاف", patch: { status: "banned" } },
      { label: "إنهاء", patch: { status: "terminated" } },
    ],
  },
  customers: {
    title: "إدارة العملاء",
    cols: [
      { key: "name", label: "العميل" },
      { key: "email", label: "البريد" },
      { key: "phone", label: "الهاتف" },
      { key: "address", label: "العنوان" },
      { key: "bonusBalanceFils", label: "رصيد البونس" },
      { key: "status", label: "الحالة" },
    ],
    actions: [
      { label: "تفعيل", patch: { status: "active" } },
      { label: "إيقاف", patch: { status: "banned" } },
    ],
  },
};

function EntityTable({
  resource,
  title,
  toast,
}: {
  resource: "stores" | "drivers" | "customers";
  title: string;
  toast: (m: string, t?: "ok" | "err") => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [history, setHistory] = useState<Row[]>([]);
  const [documents, setDocuments] = useState<{ idCardData: string; licenseData: string } | null>(null);
  const [storePanel, setStorePanel] = useState<"operations" | "menu" | "details">("operations");
  const selectedCustomerId = useRef<number | null>(null);
  const onBalanceChanged = useCallback((balance: number) => {
    setDetail((current) => current ? { ...current, bonusBalanceFils: balance } : current);
    setRows((previous) => previous.map((row) => row.id === selectedCustomerId.current ? { ...row, bonusBalanceFils: balance } : row));
  }, []);
  const meta = ENTITY_META[resource];

  const load = useCallback(async () => {
    setRows(await fetch(`/api/admin/${resource}`).then((r) => r.json()));
  }, [resource]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const patch = async (id: number, body: Row) => {
    const res = await fetch(`/api/admin/${resource}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast("تم التحديث");
      load();
    } else toast("تعذر التحديث", "err");
  };

  const openDetail = async (row: Row, panel: "operations" | "menu" | "details" = "operations") => {
    setDetail(row);
    setStorePanel(panel);
    selectedCustomerId.current = resource === "customers" ? num(row.id) : null;
    setDocuments(null);
    if (resource === "drivers") {
      const response = await fetch(`/api/admin/drivers/${row.id}/documents`, { cache: "no-store" });
      if (response.ok) setDocuments(await response.json());
    }
    const orders = await fetch("/api/orders?scope=admin").then((r) => r.json());
    const key = resource === "stores" ? "storeId" : resource === "drivers" ? "driverId" : "customerId";
    setHistory(orders.filter((o: Row) => o[key] === row.id).slice(0, 12));
  };

  return (
    <div>
      <Label>إدارة المستخدمين</Label>
      <h1 className="font-display text-3xl font-extrabold text-white">{title}</h1>
      <p className="mt-1 text-sm text-white/55">
        كل حساب يخضع لصلاحيات الأدوار — يمكن التفعيل أو الإيقاف أو الحذف نهائياً.
      </p>
      {resource === "stores" && <div className="mt-5 flex justify-end"><AdminStoreOnboarding onCreated={() => void load()} toast={toast}/></div>}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[760px] text-right text-sm">
          <thead className="bg-white/5 text-[11px] uppercase tracking-[0.16em] text-[#FDBA21]">
            <tr>
              {meta.cols.map((c) => (
                <th key={c.key} className="px-4 py-3">
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8 text-white/85">
            {rows.map((r) => (
              <tr key={String(r.id)}>
                {meta.cols.map((c) => (
                  <td key={c.key} className="px-4 py-3">
                    {c.key === "status" && resource === "stores"
                      ? (r.status === "open" ? "مفتوح" : r.status === "busy" ? "مشغول" : "مغلق")
                      : c.key.endsWith("Fils")
                        ? fmtFils(num(r[c.key]))
                        : c.key === "commissionPct"
                          ? `${num(r[c.key])}%`
                          : String(r[c.key] ?? "—")}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {meta.actions.map((a) => (
                      <button
                        key={a.label}
                        onClick={() => patch(num(r.id), a.patch)}
                        className="rounded-lg bg-white/8 px-2.5 py-1 text-xs font-bold text-[#FDBA21] transition hover:bg-[#FDBA21] hover:text-[#2A0A4A]"
                      >
                        {a.label}
                      </button>
                    ))}
                    <button
                      onClick={() => void openDetail(r)}
                      className="rounded-lg bg-white/8 px-2.5 py-1 text-xs font-bold text-white/70 transition hover:bg-white/20"
                    >
                      {resource === "stores" ? "إدارة التشغيل" : "تفاصيل"}
                    </button>
                    {resource === "stores" && (
                      <button onClick={() => void openDetail(r, "menu")}
                        className="rounded-lg bg-[#ffc531]/15 px-2.5 py-1 text-xs font-bold text-[#ffc531] transition hover:bg-[#ffc531]/30">
                        القائمة والأسعار
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm("حذف نهائي — هل أنت متأكد؟")) return;
                        await fetch(`/api/admin/${resource}/${r.id}`, { method: "DELETE" });
                        toast("تم الحذف");
                        load();
                      }}
                      className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-300"
                    >
                      حذف
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty dark text="لا توجد سجلات" />}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={resource === "stores" ? "إدارة تشغيل المتجر" : "تفاصيل الحساب"} wide>
        {detail && (
          <div className="space-y-5">
            {resource === "stores" && (
              <div className="flex flex-wrap gap-1 rounded-xl bg-[#281044]/8 p-1">
                {([
                  { key: "operations", label: "التشغيل والتوفر" },
                  { key: "menu", label: "القائمة والأسعار" },
                  { key: "details", label: "بيانات المتجر وسجل الطلبات" },
                ] as const).map((section) => (
                  <button key={section.key} type="button" onClick={() => setStorePanel(section.key)}
                    className={cn("rounded-lg px-3 py-2 text-xs font-bold transition sm:text-sm", storePanel === section.key ? "bg-[#281044] text-[#ffc531]" : "text-[#665774] hover:bg-[#281044]/10")}>
                    {section.label}
                  </button>
                ))}
              </div>
            )}
            {resource === "stores" && storePanel === "operations" && (
              <AdminStoreOperations
                key={num(detail.id)}
                storeId={num(detail.id)}
                onStoreChanged={(next) => {
                  setDetail((current) => current ? { ...current, status: next } : current);
                  void load();
                }}
                toast={toast}
              />
            )}
            {resource === "stores" && storePanel === "menu" && (
              <div className="rounded-2xl bg-[#281044] p-4 sm:p-5">
                <AdminStoreMenu key={num(detail.id)} storeId={num(detail.id)} toast={toast} />
              </div>
            )}
            {(resource !== "stores" || storePanel === "details") && <>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(detail)
                .filter(([k]) => !k.toLowerCase().includes("password") && k !== "workingHours")
                .map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-paper px-3 py-2 text-sm">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B5E7A]">
                      {k}
                    </span>
                    <p className="font-bold text-[#2B2433]">{String(v ?? "—")}</p>
                  </div>
                ))}
            </div>
            {resource === "customers" && (
              <AdminCustomerTools
                key={num(detail.id)}
                customerId={num(detail.id)}
                onBalanceChanged={onBalanceChanged}
                toast={toast}
              />
            )}
            {resource === "drivers" && (
              <div className="rounded-xl border border-[#281044]/10 bg-[#f8f4ed] p-5">
                <p className="mb-2 text-sm font-extrabold text-[#281044]">مراجعة المندوب قبل الاعتماد</p>
                <p className="text-xs text-[#6B5E7A]">البريد الإلكتروني: {detail.emailVerified ? "مؤكَّد ✓" : "لم يُؤكَّد بعد — لا يجوز اعتماده"}</p>
                {documents ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {([{ label: "بطاقة الهوية", data: documents.idCardData }, { label: "رخصة القيادة", data: documents.licenseData }] as const).map(doc => (
                      <div key={doc.label} className="overflow-hidden rounded-xl border border-[#281044]/10 bg-white p-2">
                        <p className="mb-2 text-xs font-bold text-[#281044]">{doc.label}</p>
                        {doc.data.startsWith("data:application/pdf") ? <a href={doc.data} download={`${doc.label}.pdf`} className="text-sm font-bold text-[#9c620e] underline">فتح ملف PDF</a> : <img src={doc.data} alt={doc.label} className="max-h-52 w-full rounded-lg object-contain" />}
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-3 text-xs font-bold text-rose-600">لم تُقدَّم وثائق قابلة للمراجعة لهذا الحساب.</p>}
                {String(detail.status) !== "active" && <Btn className="mt-4" disabled={!detail.emailVerified || !documents} onClick={async () => { await patch(num(detail.id), { status: "active" }); setDetail(null); }}>اعتماد المندوب وتفعيل حسابه</Btn>}
              </div>
            )}
            {resource === "drivers" && (
              <div className="rounded-2xl bg-[#281044] p-4 sm:p-5">
                <DriverAnalytics fixedDriverId={num(detail.id)} />
              </div>
            )}
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#B4520A]">
                سجل الطلبات
              </p>
              <ul className="mt-2 divide-y divide-[#2A0A4A]/8 text-sm">
                {history.map((o) => (
                  <li key={String(o.id)} className="flex items-center justify-between py-2">
                    <span className="tabular-nums">
                      {String(o.code)} · {fmtDateTime(String(o.placedAt))}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-[#6B5E7A]">
                        {ORDER_STATUS_AR[String(o.status)] ?? String(o.status)}
                      </span>
                      <Price fils={num(o.totalFils)} />
                    </span>
                  </li>
                ))}
                {!history.length && <li className="py-3 text-[#6B5E7A]">لا توجد طلبات</li>}
              </ul>
            </div>
            </>}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Requests({ toast }: { toast: (m: string, t?: "ok" | "err") => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const load = useCallback(async () => {
    setRows(await fetch("/api/admin/price-requests").then((r) => r.json()));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const decide = async (id: number, status: string) => {
    const adminNote = prompt("ملاحظة للمتجر (اختياري):") ?? "";
    await fetch("/api/admin/price-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, adminNote }),
    });
    toast(status === "approved" ? "تمت الموافقة وتحديث السعر" : "تم رفض الطلب");
    load();
  };

  return (
    <div>
      <Label>ضبط الأسعار</Label>
      <h1 className="font-display text-3xl font-extrabold text-white">طلبات تغيير الأسعار</h1>
      <p className="mt-1 text-sm text-white/55">
        لا يتغير سعر أي صنف إلا بموافقة صريحة من إدارة لقمة.
      </p>
      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[720px] text-right text-sm">
          <thead className="bg-white/5 text-[11px] uppercase tracking-[0.16em] text-[#FDBA21]">
            <tr>
              <th className="px-4 py-3">المتجر</th>
              <th className="px-4 py-3">الصنف</th>
              <th className="px-4 py-3">القديم</th>
              <th className="px-4 py-3">المطلوب</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8 text-white/85">
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td className="px-4 py-3">{String(r.storeName ?? "")}</td>
                <td className="px-4 py-3">{String(r.targetName)}</td>
                <td className="px-4 py-3 tabular-nums">{fmtFils(num(r.oldPriceFils))}</td>
                <td className="px-4 py-3 tabular-nums text-[#FDBA21]">{fmtFils(num(r.newPriceFils))}</td>
                <td className="px-4 py-3">
                  {String(r.status) === "pending" ? "قيد المراجعة" : String(r.status) === "approved" ? "مقبول" : "مرفوض"}
                </td>
                <td className="px-4 py-3">
                  {String(r.status) === "pending" ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => void decide(num(r.id), "approved")}
                        className="rounded-lg bg-[#2FA36B]/20 px-2.5 py-1 text-xs font-bold text-[#7FE0B0]"
                      >
                        موافقة
                      </button>
                      <button
                        onClick={() => void decide(num(r.id), "rejected")}
                        className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-300"
                      >
                        رفض
                      </button>
                    </div>
                  ) : (
                    <span className="text-white/45">{String(r.adminNote || "—")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty dark text="لا توجد طلبات معلّقة" />}
      </div>
    </div>
  );
}

function Admins({ toast }: { toast: (m: string, t?: "ok" | "err") => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    setRows(await fetch("/api/admin/admins").then((r) => r.json()));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div>
      <Label>صلاحيات الأدمن</Label>
      <h1 className="font-display text-3xl font-extrabold text-white">إدارة المديرين</h1>
      <p className="mt-1 text-sm text-white/55">
        حسابات فريدة بصلاحيات دقيقة: مالية، عمليات، مستخدمون، محتوى أو كامل الصلاحية.
      </p>

      <div className="mt-5 flex justify-end">
        <Btn onClick={() => setOpen(true)}>+ إنشاء حساب أدمن</Btn>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[680px] text-right text-sm">
          <thead className="bg-white/5 text-[11px] uppercase tracking-[0.16em] text-[#FDBA21]">
            <tr>
              <th className="px-4 py-3">اسم المستخدم</th>
              <th className="px-4 py-3">البريد الإداري</th>
              <th className="px-4 py-3">الاسم</th>
              <th className="px-4 py-3">المسمى</th>
              <th className="px-4 py-3">الصلاحيات</th>
              <th className="px-4 py-3">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8 text-white/85">
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                  {String(r.username)}
                </td>
                <td className="px-4 py-3 text-xs" dir="ltr">
                  {r.email ? String(r.email) : <span className="text-white/40">غير مرتبط</span>}
                </td>
                <td className="px-4 py-3">{String(r.fullName)}</td>
                <td className="px-4 py-3 text-white/55">{String(r.title)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {((r.permissions as unknown as string[]) ?? []).map((p: string) => (
                      <Pill key={p} className="border-[#FDBA21]/40 bg-[#FDBA21]/10 text-[#FDBA21]">
                        {PERMISSIONS.find((x) => x.key === p)?.label ?? p}
                      </Pill>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const email = prompt("البريد الإداري المستخدم لتسجيل الدخول:", String(r.email ?? ""));
                        if (email === null) return;
                        const res = await fetch(`/api/admin/admins/${r.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email }),
                        });
                        const data = await res.json();
                        if (!res.ok) return toast(data.error || "تعذّر حفظ البريد", "err");
                        toast("تم ربط البريد الإداري بالحساب");
                        void load();
                      }}
                      className="whitespace-nowrap rounded-lg bg-[#FDBA21]/15 px-2.5 py-1 text-xs font-bold text-[#FDBA21]"
                    >
                      {r.email ? "تعديل البريد" : "ربط بريد"}
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("حذف حساب المدير؟")) return;
                        await fetch(`/api/admin/admins/${r.id}`, { method: "DELETE" });
                        load();
                      }}
                      className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-300"
                    >
                      حذف
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="حساب أدمن جديد">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const permissions = PERMISSIONS.map((p: { key: string }) => p.key).filter(
              (k: string) => fd.get(k) === "on",
            );
            const res = await fetch("/api/admin/admins", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                username: fd.get("username"),
                email: fd.get("email"),
                password: fd.get("password"),
                fullName: fd.get("fullName"),
                title: fd.get("title"),
                permissions,
              }),
            });
            const data = await res.json();
            if (res.ok) {
              toast("تم إنشاء الحساب");
              setOpen(false);
              load();
            } else toast(data.error || "تعذر الإنشاء", "err");
          }}
        >
          <Field label="اسم المستخدم">
            <input name="username" required minLength={3} className={inputCls} dir="ltr" />
          </Field>
          <Field label="البريد الإداري" hint="يمكن لهذا المدير الدخول بالبريد أو باسم المستخدم">
            <input name="email" type="email" required className={inputCls} dir="ltr" />
          </Field>
          <Field label="الاسم الكامل">
            <input name="fullName" required className={inputCls} />
          </Field>
          <Field label="المسمى الوظيفي">
            <input name="title" className={inputCls} placeholder="مسؤول المالية" />
          </Field>
          <Field label="كلمة المرور" hint="12 حرفاً على الأقل">
            <input name="password" type="password" required minLength={12} className={inputCls} dir="ltr" />
          </Field>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#6B5E7A]">
              الصلاحيات
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PERMISSIONS.map((p: { key: string; label: string }) => (
                <label key={p.key} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-sm">
                  <input type="checkbox" name={p.key} className="accent-[#FF7A00]" />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <Btn type="submit" className="w-full">
            إنشاء الحساب
          </Btn>
        </form>
      </Modal>
    </div>
  );
}

function Cms({ toast, brand }: { toast: (m: string, t?: "ok" | "err") => void; brand: Brand }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [banners, setBanners] = useState<Row[]>([]);
  const [pages, setPages] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const d = await fetch("/api/admin/settings").then((r) => r.json());
      setSettings(d.settings);
      setBanners(d.banners);
      setPages(d.pages);
    })();
  }, []);

  const set = (k: string, v: string) => setSettings((s) => ({ ...s, [k]: v }));

  const save = async () => {
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings, banners, pages }),
    });
    if (res.ok) toast("تم تحديث الواجهة والمحتوى فوراً");
    else toast("تعذر الحفظ", "err");
  };

  return (
    <div>
      <Label>نظام إدارة المحتوى</Label>
      <h1 className="font-display text-3xl font-extrabold text-white">هوية وواجهة {brand.appNameAr ?? "لقمة"}</h1>
      <p className="mt-1 text-sm text-white/55">
        غيّر الشعار والنصوص واللافتات والصفحات الثابتة — يظهر التغيير مباشرة في كل الواجهات.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <Card dark className="p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#FDBA21]">
            الهوية والنصوص
          </p>
          <div className="mt-4 grid gap-4">
            <Field label="الشعار الرسمي — ارفع الصورة الأصلية (PNG / JPG / WEBP)">
              <input type="file" accept="image/png,image/jpeg,image/webp" className={darkInputCls} onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 750_000) return toast("الحد الأقصى للشعار 750 كيلوبايت", "err");
                const reader = new FileReader();
                reader.onload = () => set("logoUrl", String(reader.result));
                reader.readAsDataURL(file);
              }} />
            </Field>
            {settings.logoUrl && <div className="rounded-xl bg-[#19082e] p-4"><img src={settings.logoUrl} alt="معاينة الشعار الرسمي" className="max-h-36 w-auto max-w-full object-contain" /><button onClick={() => set("logoUrl", "")} className="mt-2 block text-xs text-rose-300">إزالة الشعار المخصص</button></div>}
            <Field label="أو رابط الشعار (HTTPS)">
              <input value={settings.logoUrl?.startsWith("data:") ? "" : settings.logoUrl ?? ""} onChange={(e) => set("logoUrl", e.target.value)} className={darkInputCls} dir="ltr" placeholder="https://..." />
            </Field>
            <Field label="الشعار النصي">
              <input value={settings.appNameAr ?? ""} onChange={(e) => set("appNameAr", e.target.value)} className={darkInputCls} />
            </Field>
            <Field label="العنوان الرئيسي">
              <input value={settings.heroTitle ?? ""} onChange={(e) => set("heroTitle", e.target.value)} className={darkInputCls} />
            </Field>
            <Field label="Main headline · English"><input value={settings.heroTitleEn ?? ""} onChange={e=>set("heroTitleEn",e.target.value)} className={darkInputCls} dir="ltr" /></Field>
            <Field label="الوصف">
              <textarea value={settings.heroSubtitle ?? ""} onChange={(e) => set("heroSubtitle", e.target.value)} rows={3} className={darkInputCls} />
            </Field>
            <Field label="Description · English"><textarea value={settings.heroSubtitleEn ?? ""} onChange={e=>set("heroSubtitleEn",e.target.value)} rows={3} className={darkInputCls} dir="ltr" /></Field>
            <Field label="الشعار الفرعي">
              <input value={settings.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} className={darkInputCls} />
            </Field>
            <Field label="Tagline · English"><input value={settings.taglineEn ?? ""} onChange={e=>set("taglineEn",e.target.value)} className={darkInputCls} dir="ltr" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="واتساب الدعم">
                <input value={settings.supportWhatsapp ?? ""} onChange={(e) => set("supportWhatsapp", e.target.value)} className={darkInputCls} dir="ltr" />
              </Field>
              <Field label="نص شريط الدعم">
                <input value={settings.supportLabel ?? ""} onChange={(e) => set("supportLabel", e.target.value)} className={darkInputCls} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="عمولة المتجر (د.ب)">
                <input
                  value={String(num(settings.storeCommissionFils) / 1000)}
                  onChange={(e) => set("storeCommissionFils", String(Math.round(Number(e.target.value) * 1000)))}
                  className={darkInputCls}
                  dir="ltr"
                />
              </Field>
              <Field label="عمولة التوصيل %">
                <input value={settings.deliveryCommissionPct ?? "10"} onChange={(e) => set("deliveryCommissionPct", e.target.value)} className={darkInputCls} dir="ltr" />
              </Field>
              <Field label="مهلة الإلغاء (د)">
                <input value={settings.cancelWindowMin ?? "5"} onChange={(e) => set("cancelWindowMin", e.target.value)} className={darkInputCls} dir="ltr" />
              </Field>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card dark className="p-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#FDBA21]">
              اللافتات (Banners)
            </p>
            <div className="mt-3 space-y-3">
              {banners.map((b, i) => (
                <div key={i} className="grid gap-2 rounded-xl bg-white/5 p-3">
                  <input
                    value={String(b.titleAr)}
                    onChange={(e) => setBanners((p) => p.map((x, j) => (j === i ? { ...x, titleAr: e.target.value } : x)))}
                    className={darkInputCls}
                    placeholder="العنوان"
                  />
                  <input value={String(b.titleEn ?? "")} onChange={e=>setBanners(prev=>prev.map((x,j)=>j===i?{...x,titleEn:e.target.value}:x))} className={darkInputCls} placeholder="Title · English" dir="ltr" />
                  <input
                    value={String(b.subtitleAr)}
                    onChange={(e) => setBanners((p) => p.map((x, j) => (j === i ? { ...x, subtitleAr: e.target.value } : x)))}
                    className={darkInputCls}
                    placeholder="الوصف"
                  />
                  <input value={String(b.subtitleEn ?? "")} onChange={e=>setBanners(prev=>prev.map((x,j)=>j===i?{...x,subtitleEn:e.target.value}:x))} className={darkInputCls} placeholder="Subtitle · English" dir="ltr" />
                  <input
                    value={String(b.image)}
                    onChange={(e) => setBanners((p) => p.map((x, j) => (j === i ? { ...x, image: e.target.value } : x)))}
                    className={darkInputCls}
                    dir="ltr"
                  />
                  <button onClick={() => setBanners((p) => p.filter((_, j) => j !== i))} className="text-xs font-bold text-rose-400">
                    حذف اللافتة
                  </button>
                </div>
              ))}
              <Btn
                variant="outlineLight"
                className="w-full"
                onClick={() =>
                  setBanners((p) => [
                    ...p,
                    { titleAr: "لافتة جديدة", subtitleAr: "", image: "/images/hero-feast.jpg" },
                  ])
                }
              >
                + إضافة لافتة
              </Btn>
            </div>
          </Card>

          <Card dark className="p-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#FDBA21]">
              الصفحات الثابتة
            </p>
            <div className="mt-3 space-y-4">
              {pages.map((p, i) => (
                <div key={i} className="grid gap-2 rounded-xl bg-white/5 p-3">
                  <input
                    value={String(p.titleAr)}
                    onChange={(e) => setPages((prev) => prev.map((x, j) => (j === i ? { ...x, titleAr: e.target.value } : x)))}
                    className={darkInputCls}
                  />
                  <input value={String(p.titleEn ?? "")} onChange={e=>setPages(prev=>prev.map((x,j)=>j===i?{...x,titleEn:e.target.value}:x))} className={darkInputCls} placeholder="Page title · English" dir="ltr" />
                  <textarea
                    value={String(p.bodyAr)}
                    onChange={(e) => setPages((prev) => prev.map((x, j) => (j === i ? { ...x, bodyAr: e.target.value } : x)))}
                    rows={5}
                    className={darkInputCls}
                  />
                  <textarea value={String(p.bodyEn ?? "")} onChange={e=>setPages(prev=>prev.map((x,j)=>j===i?{...x,bodyEn:e.target.value}:x))} rows={5} className={darkInputCls} dir="ltr" placeholder="Page content · English" />
                  <span className="text-xs text-white/40" dir="ltr">
                    /page/{String(p.slug)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Btn onClick={save} className="w-full py-3 text-base">
            حفظ ونشر التغييرات
          </Btn>
        </div>
      </div>
    </div>
  );
}
