"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertFlash, SoundSwitch, useLiveList, useToast } from "@/components/alert";
import { Btn, Card, ConsoleShell, Empty, Field, Modal, Pill, Price, Stat, Spinner, darkInputCls, inputCls, Tabs, Label } from "@/components/ui";
import { cn, downloadFile, fmtDate, fmtDateTime, fmtFils, fmtTime, num, ORDER_STATUS_AR, ORDER_STATUS_TONE, toCsv } from "@/lib/util";
import type { Brand } from "@/lib/brand";
import { StoreStatusSelector, WorkingHoursEditor, type StoreManualStatus } from "@/components/store-schedule-controls";
import { effectiveStoreStatus, parseWorkingHours, type WorkingPeriod } from "@/lib/working-hours";
import { useLocale } from "@/components/locale-provider";

type Line = {
  id: number;
  nameAr: string;
  sizeName: string | null;
  qty: number;
  addons: { name: string; price: number }[];
  lineTotalFils: number;
};
type Order = {
  id: number;
  code: string;
  status: string;
  customerName: string | null;
  areaName: string | null;
  subtotalFils: number;
  deliveryFeeFils: number;
  discountFils: number;
  totalFils: number;
  bonusUsedFils: number;
  paymentStatus: string;
  paymentMethod: string;
  cardLast4: string | null;
  address: string;
  note: string;
  cancelReason: string | null;
  placedAt: string;
  items: Line[];
};
type Item = {
  id: number;
  categoryId: number | null;
  nameAr: string;
  description: string;
  image: string;
  priceFils: number;
  discountPct: number;
  available: boolean;
  sizes: { id: number; nameAr: string; priceFils: number }[];
  addons: { id: number; nameAr: string; priceFils: number }[];
};
type Category = { id: number; nameAr: string };
type PriceReq = {
  id: number;
  targetName: string;
  oldPriceFils: number;
  newPriceFils: number;
  status: string;
  adminNote: string;
  createdAt: string;
};
type Discount = { id: number; code: string; percent: number; active: boolean };
type StoreProfile = {
  id: number;
  nameAr: string;
  status: string;
  workingHours: WorkingPeriod[];
  description: string;
  minOrderFils: number;
  commissionFils: number;
};

const NAV = [
  { key: "orders", label: "الطلبات", icon: "🧾" },
  { key: "menu", label: "القائمة", icon: "🍽" },
  { key: "requests", label: "تغيير الأسعار", icon: "💱" },
  { key: "discounts", label: "العروض", icon: "🏷" },
  { key: "reports", label: "التقارير", icon: "📊" },
  { key: "settings", label: "الحالة", icon: "⚙" },
];

export function StoreDashboard({ brand, logoOverride }: { brand: Brand; logoOverride?: string }) {
  const [tab, setTab] = useState("orders");
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const toast = useToast();
  const { tr } = useLocale();

  const changeStatus = async (next: StoreManualStatus) => {
    if (!profile || profile.status === next || statusSaving) return;
    setStatusSaving(true);
    try {
      const response = await fetch("/api/store/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || tr("تعذّر تحديث حالة المتجر", "Could not update restaurant status"));
      setProfile(result);
      toast.show(tr("تم تحديث حالة المتجر", "Restaurant status updated"));
    } catch (error) {
      toast.show(error instanceof Error ? error.message : tr("تعذّر الاتصال", "Connection failed"), "err");
    } finally {
      setStatusSaving(false);
    }
  };

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/store/profile");
    if (res.ok) setProfile(await res.json());
  }, []);
  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const logout = async () => {
    await fetch("/api/auth/store/logout", { method: "POST" });
    window.location.href = "/store/login";
  };

  return (
    <ConsoleShell
      brand={brand}
      logoOverride={logoOverride}
      nav={NAV}
      active={tab}
      onNav={setTab}
      user={profile?.nameAr ?? "لوحة المتجر"}
      onLogout={logout}
      right={
        <>
          <SoundSwitch />
          {profile && (
            <select
              aria-label={tr("حالة المتجر", "Restaurant status")}
              value={profile.status}
              disabled={statusSaving}
              onChange={(e) => void changeStatus(e.target.value as StoreManualStatus)}
              className="rounded-xl border border-[#FDBA21]/50 bg-[#1B0733] px-3 py-2 text-sm font-bold text-[#FDBA21] outline-none disabled:opacity-60"
            >
              <option value="open">{tr("مفتوح", "Open")}</option>
              <option value="busy">{tr("مشغول", "Busy")}</option>
              <option value="closed">{tr("مغلق", "Closed")}</option>
            </select>
          )}
        </>
      }
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {tab === "orders" && <OrdersBoard toast={toast.show} />}
        {tab === "menu" && <MenuManager toast={toast.show} />}
        {tab === "requests" && <PriceRequests toast={toast.show} />}
        {tab === "discounts" && <Discounts toast={toast.show} />}
        {tab === "reports" && <Reports />}
        {tab === "settings" && (
          <Settings
            profile={profile}
            reload={loadProfile}
            toast={toast.show}
            onStatusChange={(next) => void changeStatus(next)}
            statusSaving={statusSaving}
          />
        )}
      </div>
      {toast.node}
    </ConsoleShell>
  );
}

function OrdersBoard({ toast }: { toast: (m: string, t?: "ok" | "err") => void }) {
  const { items: orders, flash, refresh, loading } = useLiveList<Order>("/api/orders?scope=store", 5000);
  const [filter, setFilter] = useState("pending");
  const [reasonFor, setReasonFor] = useState<{ id: number; action: string } | null>(null);
  const [reason, setReason] = useState("");

  const act = async (id: number, action: string, why?: string) => {
    const res = await fetch(`/api/orders/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: why }),
    });
    const data = await res.json();
    if (res.ok) {
      toast("تم تحديث الطلب");
      refresh();
    } else toast(data.error || "تعذر التنفيذ", "err");
  };

  const groups: Record<string, string[]> = {
    pending: ["pending"],
    making: ["accepted"],
    ready: ["ready", "assigned", "onway"],
    done: ["delivered"],
    cancelled: ["rejected", "cancelled_customer", "cancelled_store", "cancelled_driver"],
  };
  const list = orders.filter((o) => groups[filter]?.includes(o.status));

  return (
    <div className={cn(flash && "edge-glow rounded-2xl")}>
      {flash && (
        <AlertFlash
          title={`طلب جديد ${flash.code}`}
          subtitle={`${flash.customerName ?? "عميل"} — ${fmtFils(flash.totalFils)} · ${flash.areaName ?? ""}`}
          onDismiss={refresh}
        />
      )}

      <SectionHead
        title="لوحة الطلبات"
        sub="تصل الطلبات الجديدة بصوت وتنبيه فوري — أول ٥ دقائق يحق للعميل الإلغاء."
      />
      <Tabs
        dark
        value={filter}
        onChange={setFilter}
        tabs={[
          { key: "pending", label: "جديدة" },
          { key: "making", label: "قيد التحضير" },
          { key: "ready", label: "جاهزة / مع مندوب" },
          { key: "done", label: "مكتملة" },
          { key: "cancelled", label: "ملغاة" },
        ]}
      />

      {loading && <Spinner label="جاري جلب الطلبات…" />}
      {!loading && list.length === 0 && <Empty dark text="لا توجد طلبات في هذه الحالة حالياً" />}

      <div className="grid gap-5 lg:grid-cols-2">
        {list.map((o, i) => (
          <article
            key={o.id}
            className={cn(
              "slam-in overflow-hidden rounded-2xl border bg-[#FAF6EF] text-[#2B2433]",
              o.status === "pending" ? "border-[#FDBA21]" : "border-white/10",
            )}
            style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}
          >
            <div
              className={cn(
                "flex items-center justify-between gap-3 px-5 py-3 text-white",
                o.status === "pending" ? "bg-gradient-to-l from-[#FF6A00] to-[#FDBA21]" : "bg-[#2A0A4A]",
              )}
            >
              <div>
                <p className={cn("font-display text-lg font-extrabold tabular-nums", o.status === "pending" && "text-[#2A0A4A]")}>
                  {o.code}
                </p>
                <p className={cn("text-xs", o.status === "pending" ? "text-[#2A0A4A]/70" : "text-white/60")}>
                  {fmtTime(o.placedAt)} · {o.customerName ?? "عميل"} · {o.areaName ?? ""}
                </p>
              </div>
              <Pill className={cn("border bg-white/85", ORDER_STATUS_TONE[o.status] ?? "")}>
                {ORDER_STATUS_AR[o.status] ?? o.status}
              </Pill>
            </div>

            {/* printed-receipt ticket */}
            <div className="px-5 py-4 font-ui text-sm">
              <ul className="divide-y divide-dashed divide-[#2A0A4A]/20">
                {o.items.map((l) => (
                  <li key={l.id} className="flex items-start justify-between gap-3 py-2">
                    <span>
                      <span className="font-extrabold tabular-nums">{l.qty}×</span> {l.nameAr}
                      {l.sizeName ? ` · ${l.sizeName}` : ""}
                      {l.addons.length > 0 && (
                        <span className="block text-xs text-[#6B5E7A]">
                          + {l.addons.map((a) => a.name).join("، ")}
                        </span>
                      )}
                    </span>
                    <Price fils={l.lineTotalFils} />
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-1 border-t border-dashed border-[#2A0A4A]/30 pt-3 text-xs text-[#6B5E7A]">
                <p>العنوان: {o.address || "—"}</p>
                {o.note && <p>ملاحظة: {o.note}</p>}
                <p>
                  الدفع:{" "}
                  {o.paymentMethod === "cash"
                    ? `نقداً عند الاستلام — المطلوب ${fmtFils(Math.max(0, o.totalFils - (o.bonusUsedFils || 0)))}`
                    : o.paymentMethod === "card" ? `بطاقة تنتهي بـ ${o.cardLast4 ?? "••••"}` : "بنفت باي"}
                </p>
                {o.bonusUsedFils > 0 && <p>بونس مستخدم: {fmtFils(o.bonusUsedFils)}</p>}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#2A0A4A]/20 pt-3 font-display text-xl font-extrabold text-[#2A0A4A]">
                <span>الإجمالي</span>
                <Price fils={o.totalFils} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 bg-white/60 px-5 py-4">
              {o.status === "pending" && (
                <>
                  <Btn onClick={() => act(o.id, "accept")}>✔ قبول الطلب</Btn>
                  <Btn
                    variant="outline"
                    onClick={() => {
                      setReasonFor({ id: o.id, action: "reject" });
                      setReason("");
                    }}
                  >
                    ✕ رفض
                  </Btn>
                </>
              )}
              {o.status === "accepted" && <Btn onClick={() => act(o.id, "ready")}>🍳 الطلب جاهز</Btn>}
              {["ready", "assigned", "onway"].includes(o.status) && (
                <span className="text-xs font-bold text-[#6B5E7A]">
                  {o.status === "ready"
                    ? "بانتظار مندوب — يُبث لكل المندوبين المتصلين"
                    : "مع المندوب"}
                </span>
              )}
              {["pending", "accepted", "ready", "assigned", "onway"].includes(o.status) && (
                <Btn
                  variant="danger"
                  onClick={() => {
                    setReasonFor({ id: o.id, action: "cancel" });
                    setReason("");
                  }}
                >
                  إلغاء الطلب
                </Btn>
              )}
            </div>
          </article>
        ))}
      </div>

      <Modal open={!!reasonFor} onClose={() => setReasonFor(null)} title="سبب مطلوب">
        <div className="space-y-4">
          <Field label="سبب الإلغاء / الرفض (إلزامي)">
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
              <option value="">اختر السبب…</option>
              <option>الصنف غير متوفر</option>
              <option>ضغط الطلبات</option>
              <option>المنطقة خارج نطاق التوصيل</option>
              <option>مشكلة في الدفع الإلكتروني</option>
              <option>سبب آخر</option>
            </select>
          </Field>
          <Btn
            variant="danger"
            disabled={!reason}
            className="w-full"
            onClick={() => {
              if (reasonFor) void act(reasonFor.id, reasonFor.action, reason);
              setReasonFor(null);
            }}
          >
            تأكيد
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <Label>لوحة المتجر</Label>
      <h1 className="font-display text-3xl font-extrabold text-white">{title}</h1>
      {sub && <p className="mt-1 text-sm text-white/55">{sub}</p>}
    </div>
  );
}

function MenuManager({ toast }: { toast: (m: string, t?: "ok" | "err") => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [newCat, setNewCat] = useState("");

  const load = useCallback(async () => {
    const [i, c] = await Promise.all([
      fetch("/api/store/items").then((r) => r.json()),
      fetch("/api/store/categories").then((r) => r.json()),
    ]);
    setItems(i);
    setCats(c);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const sizes = JSON.parse(String(fd.get("sizes") || "[]"));
    const addons = JSON.parse(String(fd.get("addons") || "[]"));
    const payload = {
      nameAr: fd.get("nameAr"),
      description: fd.get("description"),
      image: fd.get("image"),
      categoryId: fd.get("categoryId") || null,
      discountPct: Number(fd.get("discountPct") || 0),
      // the field is entered in BHD, the ledger stores fils
      priceFils: Math.round(Number(fd.get("priceFils") || 0) * 1000),
      sizes,
      addons,
    };
    const res = await fetch(editing?.id ? `/api/store/items/${editing.id}` : "/api/store/items", {
      method: editing?.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || "تعذر الحفظ", "err");
    if (data.priceRequested) toast("أُرسل طلب تغيير السعر إلى إدارة لقمة للموافقة");
    else toast("تم الحفظ");
    setEditing(null);
    load();
  };

  return (
    <div>
      <SectionHead title="إدارة القائمة" sub="الأسعار الجديدة تمر عبر طلب موافقة من إدارة لقمة." />

      <Card dark className="mb-6 p-5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#FDBA21]">الأقسام</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {cats.map((c) => (
            <span key={c.id} className="rounded-full border border-white/15 px-3 py-1.5 text-sm">
              {c.nameAr}
              <button
                onClick={async () => {
                  await fetch(`/api/store/categories/${c.id}`, { method: "DELETE" });
                  load();
                }}
                className="mr-2 text-rose-400"
                aria-label="حذف"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <form
          className="mt-4 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newCat) return;
            await fetch("/api/store/categories", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ nameAr: newCat }),
            });
            setNewCat("");
            load();
          }}
        >
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="قسم جديد (مشاوي، غداء، عشاء، مقبلات…)"
            className={darkInputCls}
          />
          <Btn type="submit">إضافة قسم</Btn>
        </form>
      </Card>

      <div className="mb-4 flex justify-end">
        <Btn onClick={() => setEditing({ available: true, discountPct: 0 })}>+ صنف جديد</Btn>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[640px] text-right text-sm">
          <thead className="bg-white/5 text-[11px] uppercase tracking-[0.16em] text-[#FDBA21]">
            <tr>
              <th className="px-4 py-3">الصنف</th>
              <th className="px-4 py-3">القسم</th>
              <th className="px-4 py-3">السعر</th>
              <th className="px-4 py-3">الأحجام / الإضافات</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">خيارات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {items.map((it) => (
              <tr key={it.id} className="text-white/85">
                <td className="px-4 py-3 font-bold">{it.nameAr}</td>
                <td className="px-4 py-3 text-white/55">
                  {cats.find((c) => c.id === it.categoryId)?.nameAr ?? "—"}
                </td>
                <td className="px-4 py-3 tabular-nums">{fmtFils(it.priceFils)}</td>
                <td className="px-4 py-3 text-white/55">
                  {it.sizes.length} أحجام · {it.addons.length} إضافات
                </td>
                <td className="px-4 py-3">
                    <button
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/store/items/${it.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ available: !it.available }),
                        });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.error || "تعذر تغيير توفر الصنف");
                        toast(it.available ? "الصنف غير متوفر الآن" : "الصنف متوفر الآن");
                        await load();
                      } catch (error) {
                        toast(error instanceof Error ? error.message : "تعذر الاتصال", "err");
                      }
                    }}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold",
                      it.available ? "bg-[#2FA36B]/20 text-[#7FE0B0]" : "bg-rose-500/20 text-rose-300",
                    )}
                  >
                    {it.available ? "متوفر" : "غير متوفر"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(it)} className="text-[#FDBA21]">
                      تعديل
                    </button>
                    <button
                      onClick={async () => {
                        await fetch(`/api/store/items/${it.id}`, { method: "DELETE" });
                        load();
                      }}
                      className="text-rose-400"
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "تعديل صنف" : "صنف جديد"} wide>
        {editing && (
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="اسم الصنف">
              <input name="nameAr" required defaultValue={editing.nameAr} className={inputCls} />
            </Field>
            <Field label="القسم">
              <select name="categoryId" defaultValue={editing.categoryId ?? ""} className={inputCls}>
                <option value="">بدون قسم</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الوصف" className="sm:col-span-2">
              <textarea name="description" defaultValue={editing.description} rows={2} className={inputCls} />
            </Field>
            <Field label="رابط الصورة" className="sm:col-span-2">
              <input name="image" defaultValue={editing.image} placeholder="/images/r-grill.jpg" className={inputCls} dir="ltr" />
            </Field>
            <Field label="السعر (د.ب)" hint="تغيير السعر يرسل طلب موافقة للإدارة">
              <input
                name="priceFils"
                type="number"
                step="0.001"
                min="0"
                required
                defaultValue={editing.priceFils != null ? num(editing.priceFils) / 1000 : ""}
                className={inputCls}
                dir="ltr"
              />
            </Field>
            <Field label="خصم %">
              <input name="discountPct" type="number" min="0" max="90" defaultValue={editing.discountPct ?? 0} className={inputCls} dir="ltr" />
            </Field>
            <Field label="الأحجام (JSON)" className="sm:col-span-2" hint='[{"nameAr":"عادي","priceFils":2500}]'>
              <textarea
                name="sizes"
                rows={3}
                defaultValue={JSON.stringify(editing.sizes?.map((s) => ({ nameAr: s.nameAr, priceFils: s.priceFils })) ?? [])}
                className={cn(inputCls, "font-mono text-xs")}
                dir="ltr"
              />
            </Field>
            <Field label="الإضافات (JSON)" className="sm:col-span-2" hint='[{"nameAr":"جبنة","priceFils":500}]'>
              <textarea
                name="addons"
                rows={3}
                defaultValue={JSON.stringify(editing.addons?.map((a) => ({ nameAr: a.nameAr, priceFils: a.priceFils })) ?? [])}
                className={cn(inputCls, "font-mono text-xs")}
                dir="ltr"
              />
            </Field>
            <div className="sm:col-span-2">
              <Btn type="submit" className="w-full">
                حفظ الصنف
              </Btn>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function PriceRequests({ toast }: { toast: (m: string, t?: "ok" | "err") => void }) {
  const [rows, setRows] = useState<PriceReq[]>([]);
  const load = useCallback(async () => {
    setRows(await fetch("/api/store/price-requests").then((r) => r.json()));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  void toast;

  return (
    <div>
      <SectionHead title="طلبات تغيير الأسعار" sub="لا يُطبَّق أي تغيير سعر إلا بعد موافقة إدارة لقمة." />
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[640px] text-right text-sm">
          <thead className="bg-white/5 text-[11px] uppercase tracking-[0.16em] text-[#FDBA21]">
            <tr>
              <th className="px-4 py-3">الصنف</th>
              <th className="px-4 py-3">القديم</th>
              <th className="px-4 py-3">المطلوب</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">ملاحظة الإدارة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8 text-white/85">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-bold">{r.targetName}</td>
                <td className="px-4 py-3 tabular-nums">{fmtFils(r.oldPriceFils)}</td>
                <td className="px-4 py-3 tabular-nums text-[#FDBA21]">{fmtFils(r.newPriceFils)}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold",
                      r.status === "approved"
                        ? "bg-[#2FA36B]/20 text-[#7FE0B0]"
                        : r.status === "rejected"
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-[#FDBA21]/20 text-[#FDBA21]",
                    )}
                  >
                    {r.status === "approved" ? "مقبول" : r.status === "rejected" ? "مرفوض" : "قيد المراجعة"}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/55">{r.adminNote || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty dark text="لا توجد طلبات تغيير أسعار" />}
      </div>
    </div>
  );
}

function Discounts({ toast }: { toast: (m: string, t?: "ok" | "err") => void }) {
  const [rows, setRows] = useState<Discount[]>([]);
  const load = useCallback(async () => {
    setRows(await fetch("/api/store/discounts").then((r) => r.json()));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <SectionHead title="العروض والخصومات" sub="خصومات بنسبة مئوية تُطبَّق بكود خصم عند الدفع." />
      <Card dark className="mb-6 p-5">
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const res = await fetch("/api/store/discounts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: fd.get("code"), percent: fd.get("percent") }),
            });
            const data = await res.json();
            if (res.ok) {
              toast("تم إنشاء العرض");
              load();
            } else toast(data.error || "تعذر الإنشاء", "err");
          }}
        >
          <input name="code" placeholder="كود الخصم (DIWAN15)" className={darkInputCls} required />
          <input name="percent" type="number" min="1" max="90" placeholder="%" className={darkInputCls} required />
          <Btn type="submit">إنشاء عرض</Btn>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((d) => (
          <Card key={d.id} dark className="p-5">
            <p className="font-display text-2xl font-extrabold text-[#FDBA21]">{d.code}</p>
            <p className="mt-1 text-sm text-white/60">خصم {d.percent}% على الإجمالي</p>
            <div className="mt-4 flex gap-2">
              <Btn
                variant={d.active ? "outlineLight" : "gold"}
                onClick={async () => {
                  await fetch(`/api/store/discounts/${d.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ active: !d.active }),
                  });
                  load();
                }}
              >
                {d.active ? "إيقاف" : "تفعيل"}
              </Btn>
              <Btn
                variant="danger"
                onClick={async () => {
                  await fetch(`/api/store/discounts/${d.id}`, { method: "DELETE" });
                  load();
                }}
              >
                حذف
              </Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

type Report = {
  rows: {
    period: string;
    orders: number;
    delivered: number;
    cancelled: number;
    gross: number;
    discount: number;
    delivery: number;
    commission: number;
    net: number;
  }[];
  totals: {
    orders: number;
    delivered: number;
    cancelled: number;
    gross: number;
    discount: number;
    delivery: number;
    commission: number;
    net: number;
  };
};

function Reports() {
  const [preset, setPreset] = useState("daily");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Report | null>(null);
  const [group, setGroup] = useState("day");

  const load = useCallback(async () => {
    const params = new URLSearchParams({ preset, group });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/store/reports?${params}`);
    if (res.ok) setData(await res.json());
  }, [preset, from, to, group]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = () => {
    if (!data) return;
    const csv = toCsv(
      data.rows.map((r) => ({
        الفترة: r.period,
        الطلبات: r.orders,
        المكتملة: r.delivered,
        الملغاة: r.cancelled,
        المبيعات: (r.gross / 1000).toFixed(3),
        الخصومات: (r.discount / 1000).toFixed(3),
        رسوم_التوصيل: (r.delivery / 1000).toFixed(3),
        عمولة_لقمة: (r.commission / 1000).toFixed(3),
        صافي_المتجر: (r.net / 1000).toFixed(3),
      })),
      [],
    );
    downloadFile(`luqma-store-report-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="print-area">
      <SectionHead title="التقارير المالية" sub="يومي · أسبوعي · شهري · أو مدى تاريخ مخصص." />
      <Card dark className="mb-5 p-5 no-print">
        <Tabs
          dark
          value={preset}
          onChange={setPreset}
          tabs={[
            { key: "daily", label: "اليوم" },
            { key: "weekly", label: "الأسبوع" },
            { key: "monthly", label: "الشهر" },
            { key: "custom", label: "مدى مخصص" },
          ]}
        />
        <div className="flex flex-wrap items-end gap-3">
          {preset === "custom" && (
            <>
              <Field label="من">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={darkInputCls} />
              </Field>
              <Field label="إلى">
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={darkInputCls} />
              </Field>
            </>
          )}
          <Field label="التجميع">
            <select value={group} onChange={(e) => setGroup(e.target.value)} className={darkInputCls}>
              <option value="day">يومي</option>
              <option value="week">أسبوعي</option>
              <option value="month">شهري</option>
            </select>
          </Field>
          <Btn variant="gold" onClick={exportCsv}>
            ⬇ تصدير Excel (CSV)
          </Btn>
          <Btn variant="outlineLight" onClick={() => window.print()}>
            🖨 حفظ PDF / طباعة
          </Btn>
        </div>
      </Card>

      {data && (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat dark label="إجمالي المبيعات" value={fmtFils(data.totals.gross)} />
            <Stat dark label="عمولة لقمة" value={fmtFils(data.totals.commission)} accent />
            <Stat dark label="صافي المتجر" value={fmtFils(data.totals.net)} />
            <Stat
              dark
              label="الطلبات"
              value={String(data.totals.orders)}
              sub={`${data.totals.delivered} مكتملة · ${data.totals.cancelled} ملغاة`}
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead className="bg-white/5 text-[11px] uppercase tracking-[0.16em] text-[#FDBA21]">
                <tr>
                  <th className="px-4 py-3">الفترة</th>
                  <th className="px-4 py-3">الطلبات</th>
                  <th className="px-4 py-3">المبيعات</th>
                  <th className="px-4 py-3">الخصومات</th>
                  <th className="px-4 py-3">التوصيل</th>
                  <th className="px-4 py-3">عمولة لقمة</th>
                  <th className="px-4 py-3">صافي المتجر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 tabular-nums text-white/85">
                {data.rows.map((r) => (
                  <tr key={r.period}>
                    <td className="px-4 py-3">{fmtDate(r.period)}</td>
                    <td className="px-4 py-3">{r.orders}</td>
                    <td className="px-4 py-3">{fmtFils(r.gross)}</td>
                    <td className="px-4 py-3">{fmtFils(r.discount)}</td>
                    <td className="px-4 py-3">{fmtFils(r.delivery)}</td>
                    <td className="px-4 py-3 text-[#FDBA21]">{fmtFils(r.commission)}</td>
                    <td className="px-4 py-3 font-bold">{fmtFils(r.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.rows.length && <Empty dark text="لا توجد حركة في هذه الفترة" />}
          </div>
          <p className="mt-4 text-xs text-white/45">
            عمولة لقمة الافتراضية: 0.500 د.ب ثابتة لكل طلب مكتمل — تُحتسب ضمن صافي المتجر.
          </p>
        </>
      )}
    </div>
  );
}

function Settings({
  profile,
  reload,
  toast,
  onStatusChange,
  statusSaving,
}: {
  profile: StoreProfile | null;
  reload: () => void | Promise<void>;
  toast: (m: string, t?: "ok" | "err") => void;
  onStatusChange: (next: StoreManualStatus) => void;
  statusSaving: boolean;
}) {
  const { tr } = useLocale();
  const [desc, setDesc] = useState("");
  const [minOrder, setMinOrder] = useState(0);
  const [workingHours, setWorkingHours] = useState<WorkingPeriod[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (profile) {
      setDesc(profile.description);
      setMinOrder(profile.minOrderFils / 1000);
      setWorkingHours(Array.isArray(profile.workingHours) ? profile.workingHours : []);
    }
  }, [profile]);

  const save = async () => {
    const validated = parseWorkingHours(workingHours);
    if (!validated.ok) return toast(validated.error, "err");
    if (!Number.isFinite(minOrder) || minOrder < 0) {
      return toast(tr("الحد الأدنى للطلب غير صالح", "Invalid minimum order"), "err");
    }
    setSaving(true);
    try {
      const response = await fetch("/api/store/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: desc,
          minOrderFils: Math.round(minOrder * 1000),
          workingHours: validated.periods,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || tr("تعذّر حفظ الإعدادات", "Could not save settings"));
      toast(tr("حُفظت أوقات العمل والإعدادات", "Opening hours and settings saved"));
      await reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : tr("تعذّر الاتصال", "Connection failed"), "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHead
        title={tr("حالة المتجر وأوقات العمل", "Restaurant status & opening hours")}
        sub={tr("تحكم بالحالة الآن، وحدد فترة أو أكثر لكل يوم من الأسبوع.", "Set your current status and one or more periods for each day of the week.")}
      />
      <Card dark className="max-w-4xl p-5 sm:p-6">
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="mb-3 text-sm font-bold text-white">{tr("الحالة اليدوية الحالية", "Current manual status")}</p>
            <StoreStatusSelector value={profile?.status ?? "closed"} onChange={onStatusChange} disabled={!profile || statusSaving} />
            {profile?.workingHours?.length ? (
              <p className="mt-3 text-xs leading-5 text-white/60">
                {tr("الحالة الظاهرة الآن حسب ساعات البحرين: ", "Currently shown in Bahrain time: ")}
                <strong className="text-[#ffc531]">{tr(
                  effectiveStoreStatus(profile.status, profile.workingHours) === "open" ? "مفتوح" : effectiveStoreStatus(profile.status, profile.workingHours) === "busy" ? "مشغول" : "مغلق",
                  effectiveStoreStatus(profile.status, profile.workingHours) === "open" ? "Open" : effectiveStoreStatus(profile.status, profile.workingHours) === "busy" ? "Busy" : "Closed",
                )}</strong>
                {tr(". ساعات العمل تُغلق المتجر خارج فتراته، والحالة اليدوية مشغول/مغلق لها الأولوية.", ". Opening hours close the restaurant outside scheduled periods; manual Busy/Closed always takes precedence.")}
              </p>
            ) : null}
          </div>
          <WorkingHoursEditor value={workingHours} onChange={setWorkingHours} />
          <div className="grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
            <Field label={tr("وصف المتجر", "Restaurant description")} className="sm:col-span-2">
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className={darkInputCls} />
            </Field>
            <Field label={tr("الحد الأدنى للطلب (د.ب)", "Minimum order (BHD)")}>
              <input type="number" min="0" step="0.001" value={minOrder} onChange={(e) => setMinOrder(Number(e.target.value))} className={darkInputCls} dir="ltr" />
            </Field>
          </div>
          <Btn onClick={save} disabled={saving || !profile} className="w-full sm:w-auto">
            {saving ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ أوقات العمل والإعدادات", "Save hours & settings")}
          </Btn>
        </div>
        {profile && (
          <p className="mt-6 rounded-xl bg-white/5 p-4 text-xs text-white/55">
            {tr("عمولة لقمة على كل طلب مكتمل:", "Luqma commission per completed order:")} {fmtFils(profile.commissionFils)}
          </p>
        )}
      </Card>
    </div>
  );
}
