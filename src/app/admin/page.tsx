"use client";
import { useEffect, useState } from "react";
import { Btn, Field, inputCls, Logo, LangToggle, Spinner } from "@/components/ui";
import { useL } from "@/lib/i18n";
import { OverviewTab, ApprovalsTab, StoresTab, DriversTab, CustomersTab, OrdersAllTab } from "@/components/admin/sections1";
import { ReportsTab, AdminsTab, SettingsTab, CMSTab, CancelledTab, LocationsTab } from "@/components/admin/sections2";

type AdminUser = { id: number; username: string; isMaster: boolean; fullName: string; permissions: string[] } | null;

export default function AdminPage() {
  const { s } = useL();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [f, setF] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    (async () => {
      const p = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "me-admin" }) }).catch(() => null);
      if (p && p.ok) {
        const j = await p.json();
        setAdmin(j.admin);
      }
      setChecking(false);
    })();
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", role: "admin", identifier: f.username, password: f.password }) });
    const j = await r.json();
    setBusy(false);
    if (j.error) {
      setErr(j.error);
      return;
    }
    if (j.ok) {
      setAdmin(j.user);
      setTab("overview");
    }
  };

  const logout = async () => {
    await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout", role: "admin" }) });
    setAdmin(null);
  };

  if (checking) return <div className="grid min-h-screen place-items-center bg-[#12051D]"><Spinner light /></div>;

  /* ---------------- LOGIN GATE ---------------- */
  if (!admin) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[#12051D] p-4">
        <div className="absolute inset-0 opacity-50" style={{ background: "radial-gradient(800px 400px at 80% 0%, rgba(247,181,0,0.12), transparent 60%), radial-gradient(700px 400px at 10% 100%, rgba(109,63,160,0.35), transparent 60%)" }} />
        <div className="relative w-full max-w-sm">
          <div className="mb-5 flex flex-col items-center gap-2">
            <Logo size={64} withText={false} />
            <h1 className="text-lg font-black text-white">{s("مركز تحكم لقمة", "Luqma Control Center")}</h1>
            <p className="text-[11px] text-white/40">{s("دخول مخصص — محمي", "Restricted access")}</p>
          </div>
          <form onSubmit={login} className="space-y-3 rounded-3xl bg-white p-6 shadow-2xl fade-up">
            {err && <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-600">{err}</div>}
            <Field label={s("اسم المستخدم", "Username")}>
              <input dir="ltr" className={inputCls} value={f.username} onChange={(e) => setF((p) => ({ ...p, username: e.target.value }))} required />
            </Field>
            <Field label={s("كلمة المرور", "Password")}>
              <input dir="ltr" type="password" className={inputCls} value={f.password} onChange={(e) => setF((p) => ({ ...p, password: e.target.value }))} required />
            </Field>
            <Btn type="submit" variant="purple" className="w-full" disabled={busy}>{busy ? <Spinner /> : s("دخول لوحة التحكم", "Enter control panel")}</Btn>
            <p className="text-center text-[10px] leading-relaxed text-gray-400">
              {s("استعادة كلمة مرور المدير الرئيسي تُرسل حصرياً إلى بريد المدير المعتمد.", "Master admin password recovery is sent exclusively to the master admin email.")}
            </p>
          </form>
        </div>
      </div>
    );
  }

  /* ---------------- CONTROL CENTER ---------------- */
  const tabs: [string, string, boolean?][] = [
    ["overview", s("نظرة عامة", "Overview")],
    ["approvals", s("الموافقات", "Approvals")],
    ["orders", s("كل الطلبات", "All orders")],
    ["stores", s("المطاعم", "Stores")],
    ["drivers", s("المندوبون", "Drivers")],
    ["customers", s("العملاء", "Customers")],
    ["locations", s("المحافظات والمناطق", "Locations")],
    ["reports", s("التقارير المالية", "Financial reports")],
    ["settings", s("الدفع والعمولات", "Payments & fees")],
    ["cms", s("إدارة المحتوى CMS", "Content CMS")],
    ["cancelled", s("سجل الإلغاءات", "Cancelled log")],
    ["admins", s("المدراء والصلاحيات", "Admins & permissions"), true],
  ];

  return (
    <div dir={document.documentElement.dir} className="min-h-screen bg-[#12051D] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#12051D]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <div>
              <p className="text-sm font-black">{s("مركز التحكم والـ CMS", "Control Center & CMS")}</p>
              <p className="text-[10px] text-white/45">
                {admin.username} {admin.isMaster && <span className="rounded bg-gold-500/15 border border-gold-500/30 px-1.5 py-0.5 text-[9px] font-black text-gold-300">{s("المدير الرئيسي", "MASTER")}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LangToggle />
            <Btn variant="gold" className="px-3 py-1.5 text-[11px]" onClick={() => { window.location.href = "/"; }}>{s("عرض الموقع", "View site")}</Btn>
            <Btn variant="outline" className="px-3 py-1.5 text-[11px] border-white/25 bg-transparent text-white hover:bg-white/10" onClick={logout}>{s("خروج", "Logout")}</Btn>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 lg:flex-row">
        <nav className="no-print shrink-0 lg:w-56">
          <div className="flex gap-1.5 overflow-x-auto pb-2 lg:sticky lg:top-20 lg:flex-col lg:overflow-visible">
            {tabs.filter((t) => !t[2] || admin.isMaster).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-start text-xs font-black transition ${tab === k ? "bg-gold-500 text-royal-950 shadow-lg shadow-gold-500/20" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
        <main className="min-w-0 flex-1 pb-10">
          {tab === "overview" && <OverviewTab />}
          {tab === "approvals" && <ApprovalsTab />}
          {tab === "orders" && <OrdersAllTab />}
          {tab === "stores" && <StoresTab />}
          {tab === "drivers" && <DriversTab />}
          {tab === "customers" && <CustomersTab />}
          {tab === "locations" && <LocationsTab />}
          {tab === "reports" && <ReportsTab />}
          {tab === "settings" && <SettingsTab />}
          {tab === "cms" && <CMSTab />}
          {tab === "cancelled" && <CancelledTab />}
          {tab === "admins" && admin.isMaster && <AdminsTab />}
        </main>
      </div>
    </div>
  );
}
