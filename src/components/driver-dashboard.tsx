"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertFlash, SoundSwitch, useToast } from "@/components/alert";
import { Btn, Card, ConsoleShell, Empty, Field, Modal, Pill, Price, Spinner, Stat, darkInputCls, inputCls, Tabs, Label } from "@/components/ui";
import { Logo } from "@/components/brand";
import { DriverAuth } from "@/components/driver-auth";
import { cn, downloadFile, fmtDate, fmtDateTime, fmtFils, toCsv } from "@/lib/util";
import type { Brand } from "@/lib/brand";

type Order = {
  id: number;
  code: string;
  status: string;
  storeName: string | null;
  storeAddress: string | null;
  storePhone: string | null;
  areaName: string | null;
  customerName: string | null;
  address: string;
  totalFils: number;
  bonusUsedFils: number;
  paymentMethod: string;
  paymentStatus: string;
  deliveryFeeFils: number;
  deliveryCommissionPct: number;
  placedAt: string;
  cancelReason?: string | null;
  driverEarningsFils?: number;
};

const NAV = [
  { key: "board", label: "الطلبات", icon: "🛵" },
  { key: "ledger", label: "الأرباح", icon: "📒" },
  { key: "profile", label: "حسابي", icon: "👤" },
];

export function DriverApp({ brand, logoOverride }: { brand: Brand; logoOverride?: string }) {
  const [me, setMe] = useState<{ id: number; name: string; status: string; online: boolean } | null | "loading">("loading");
  const [authed, setAuthed] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/driver/profile");
      if (res.ok) {
        const d = await res.json();
        setMe({ id: d.id, name: d.name, status: d.status, online: d.online });
        setAuthed(true);
      } else {
        setMe(null);
        setAuthed(false);
      }
    })();
  }, []);

  if (me === "loading") return <Spinner label="جاري التحقق…" />;

  if (!authed)
    return (
      <DriverAuth
        brand={brand}
        logoOverride={logoOverride}
        onDone={() => window.location.reload()}
      />
    );

  return <DriverConsole brand={brand} logoOverride={logoOverride} me={me!} toast={toast.show} />;
}

function DriverConsole({
  brand,
  logoOverride,
  me,
  toast,
}: {
  brand: Brand;
  logoOverride?: string;
  me: { id: number; name: string; status: string; online: boolean };
  toast: (m: string, t?: "ok" | "err") => void;
}) {
  const [tab, setTab] = useState("board");
  const [online, setOnline] = useState(me.online);
  const [reasonFor, setReasonFor] = useState<number | null>(null);
  const [cashFor, setCashFor] = useState<Order | null>(null);
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [reason, setReason] = useState("");

  const [pool, setPool] = useState<Order[]>([]);
  const [mine, setMine] = useState<Order[]>([]);

  const loadBoard = useCallback(async () => {
    const res = await fetch("/api/driver/board");
    if (!res.ok) return;
    const d = await res.json();
    setPool(d.pool);
    setMine(d.mine);
  }, []);

  useEffect(() => {
    void loadBoard();
    const id = window.setInterval(() => void loadBoard(), 5000);
    return () => window.clearInterval(id);
  }, [loadBoard]);

  // alert on brand-new broadcast orders
  const [flashId, setFlashId] = useState<number | null>(null);
  const seen = useState<{ current: Set<number> | null }>({ current: null })[0];
  useEffect(() => {
    if (!online) return;
    if (seen.current === null) {
      seen.current = new Set(pool.map((p) => p.id));
      return;
    }
    const fresh = pool.find((p) => !seen.current!.has(p.id));
    seen.current = new Set(pool.map((p) => p.id));
    if (fresh) {
      setFlashId(fresh.id);
      if (window.localStorage.getItem("luqma_sound") !== "off") {
        import("@/components/alert").then((m) => m.chime("order"));
      }
      window.setTimeout(() => setFlashId(null), 6000);
    }
  }, [pool, online, seen]);

  const act = async (id: number, action: string, why?: string, cashCollected = false) => {
    const res = await fetch(`/api/orders/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: why, cashCollected }),
    });
    const data = await res.json();
    if (res.ok) {
      toast(action === "accept" ? "تم قبول الطلب — توجّه للمتجر" : "تم التحديث");
      void loadBoard();
    } else toast(data.error || "تعذر التنفيذ", "err");
    return res.ok;
  };

  const logout = async () => {
    await fetch("/api/auth/driver/logout", { method: "POST" });
    window.location.href = "/driver";
  };

  return (
    <ConsoleShell
      brand={brand}
      logoOverride={logoOverride}
      nav={NAV}
      active={tab}
      onNav={setTab}
      user={me.name}
      onLogout={logout}
      right={
        <>
          <SoundSwitch />
          <button
            onClick={async () => {
              const next = !online;
              setOnline(next);
              await fetch("/api/driver/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ online: next }),
              });
              toast(next ? "أنت الآن متصل وتستقبل الطلبات" : "أنت غير متصل");
            }}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-extrabold transition",
              online
                ? "bg-[#2FA36B] text-white shadow-[0_0_24px_-6px_rgba(47,163,107,0.9)]"
                : "bg-white/10 text-white/60",
            )}
          >
            {online ? "● متصل" : "○ غير متصل"}
          </button>
        </>
      }
    >
      <div
        className={cn(
          "mx-auto max-w-5xl px-4 py-6 sm:px-6",
          flashId !== null && "edge-glow rounded-2xl",
        )}
      >
        {flashId && (
          <AlertFlash
            title="طلب توصيل جديد!"
            subtitle={`${pool.find((p) => p.id === flashId)?.storeName ?? ""} — اقبل قبل غيرك`}
            onDismiss={() => setFlashId(null)}
          />
        )}

        {tab === "board" && (
          <div>
            <Label>لوحة البثّ</Label>
            <h1 className="font-display text-3xl font-extrabold text-white">طلبات التوصيل</h1>
            <p className="mt-1 text-sm text-white/55">
              تُبثّ الطلبات لكل المندوبين المتصلين في نفس اللحظة — أول من يقبل يأخذها.
            </p>

            <h2 className="mt-8 mb-3 font-display text-xl font-extrabold text-[#FDBA21]">
              متاحة الآن ({pool.length})
            </h2>
            {!online && (
              <p className="mb-4 rounded-xl border border-[#FDBA21]/40 bg-[#FDBA21]/10 px-4 py-3 text-sm font-bold text-[#FDBA21]">
                أنت غير متصل — فعّل الاتصال لاستقبال الطلبات الجديدة.
              </p>
            )}
            {!pool.length && <Empty dark text="لا توجد طلبات متاحة حالياً" />}
            <div className="grid gap-4 lg:grid-cols-2">
              {pool.map((o) => (
                <article key={o.id} className="slam-in rounded-2xl border border-[#FDBA21]/50 bg-[#2A0A4A] p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-lg font-extrabold text-white tabular-nums">{o.code}</p>
                    <Pill className="border-[#FDBA21]/50 bg-[#FDBA21]/15 text-[#FDBA21]">
                      توصيل {fmtFils(o.deliveryFeeFils)}
                    </Pill>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-sm text-white/70">
                    <div className="flex justify-between gap-3">
                      <dt>المتجر</dt>
                      <dd className="font-bold text-white">{o.storeName}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>العنوان</dt>
                      <dd>{o.areaName}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>العميل</dt>
                      <dd>{o.customerName}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>الإجمالي</dt>
                      <dd className="tabular-nums text-[#FDBA21]">{fmtFils(o.totalFils)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 font-bold">
                      <dt>الدفع</dt>
                      <dd className={o.paymentMethod === "cash" ? "text-[#FDBA21]" : "text-white"}>
                        {o.paymentMethod === "cash" ? `نقداً ${fmtFils(Math.max(0, o.totalFils - (o.bonusUsedFils || 0)))}` : o.paymentMethod === "card" ? "بطاقة — مدفوع" : "بنفت باي — مدفوع"}
                      </dd>
                    </div>
                  </dl>
                  <Btn className="mt-4 w-full" disabled={!online} onClick={() => act(o.id, "accept")}>
                    قبول الطلب
                  </Btn>
                </article>
              ))}
            </div>

            <h2 className="mt-10 mb-3 font-display text-xl font-extrabold text-[#FDBA21]">
              طلباتي الحالية ({mine.length})
            </h2>
            {!mine.length && <Empty dark text="لا يوجد لديك طلب جارٍ" />}
            <div className="grid gap-4 lg:grid-cols-2">
              {mine.map((o) => (
                <article key={o.id} className="rounded-2xl border border-white/10 bg-[#2A0A4A] p-5">
                  <p className="font-display text-lg font-extrabold text-white tabular-nums">{o.code}</p>
                  <p className="mt-1 text-sm text-white/60">
                    {o.storeName} — {o.storeAddress}
                  </p>
                  <p className="text-sm text-white/60">
                    التسليم: {o.customerName} · {o.address}
                  </p>
                  <p className="mt-2 text-sm font-bold text-[#FDBA21]">
                    {o.paymentMethod === "cash" ? `تحصيل نقدي عند الاستلام: ${fmtFils(Math.max(0, o.totalFils - (o.bonusUsedFils || 0)))}` : "مدفوع إلكترونياً"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {o.status === "assigned" && (
                      <Btn onClick={() => act(o.id, "pickup")}>استلمت الطلب</Btn>
                    )}
                    {o.status === "onway" && (o.paymentStatus === "cash_due"
                      ? <Btn onClick={() => { setCashFor(o); setCashConfirmed(false); }}>تأكيد التحصيل والتسليم</Btn>
                      : <Btn onClick={() => act(o.id, "deliver")}>تم التسليم</Btn>)}
                    <Btn
                      variant="danger"
                      onClick={() => {
                        setReasonFor(o.id);
                        setReason("");
                      }}
                    >
                      إلغاء وإعادة البثّ
                    </Btn>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "ledger" && <Ledger />}

        {tab === "profile" && (
          <div>
            <Label>حساب المندوب</Label>
            <h1 className="font-display text-3xl font-extrabold text-white">بياناتي</h1>
            <Card dark className="mt-5 max-w-2xl p-6">
              <p className="text-sm text-white/70">
                الحالة: <span className="font-bold text-[#FDBA21]">مفعّل</span> · عمولة المنصّة 10%
                من رسوم التوصيل.
              </p>
              <p className="mt-3 text-xs text-white/45">
                لتعديل بيانات الهوية أو الرخصة يرجى التواصل مع دعم {brand.appNameAr ?? "لقمة"} عبر
                واتساب {brand.supportWhatsapp}.
              </p>
            </Card>
          </div>
        )}
      </div>

      <Modal open={!!reasonFor} onClose={() => setReasonFor(null)} title="سبب إلغاء الطلب">
        <div className="space-y-4">
          <p className="text-sm text-[#6B5E7A]">
            عند الإلغاء يعود الطلب للوحة البثّ ويُعرض على باقي المندوبين فوراً.
          </p>
          <Field label="السبب (إلزامي)">
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
              <option value="">اختر السبب…</option>
              <option>عطل في المركبة</option>
              <option>المتجر مغلق</option>
              <option>عنوان العميل بعيد</option>
              <option>ظرف طارئ</option>
              <option>سبب آخر</option>
            </select>
          </Field>
          <Btn
            variant="danger"
            className="w-full"
            disabled={!reason}
            onClick={() => {
              if (reasonFor) void act(reasonFor, "cancel", reason);
              setReasonFor(null);
            }}
          >
            تأكيد الإلغاء
          </Btn>
        </div>
      </Modal>
      <Modal open={!!cashFor} onClose={() => setCashFor(null)} title="تأكيد التحصيل النقدي">
        {cashFor && <div className="space-y-4">
          <p className="text-sm text-[#6B5E7A]">تأكد من استلام المبلغ النقدي من العميل قبل تأكيد تسليم الطلب.</p>
          <div className="rounded-xl bg-[#fff8e9] p-4 text-center"><p className="text-xs text-[#806536]">المبلغ المطلوب من العميل</p><p className="mt-1 font-display text-2xl font-extrabold text-[#281044]">{fmtFils(Math.max(0, cashFor.totalFils - (cashFor.bonusUsedFils || 0)))}</p></div>
          <label className="flex items-center gap-2 text-sm font-bold text-[#281044]"><input type="checkbox" checked={cashConfirmed} onChange={(event) => setCashConfirmed(event.target.checked)} className="accent-[#281044]" />أؤكد استلام المبلغ النقدي كاملاً</label>
          <Btn disabled={!cashConfirmed} className="w-full" onClick={async () => { if (await act(cashFor.id, "deliver", undefined, true)) setCashFor(null); }}>تم التحصيل والتسليم</Btn>
        </div>}
      </Modal>
    </ConsoleShell>
  );
}

type LedgerData = {
  rows: (Order & { driverEarningsFils: number })[];
  totals: {
    orders: number;
    delivered: number;
    duesFils: number;
    paidFils: number;
    remainingFils: number;
    commissionFils: number;
  };
  payouts: { id: number; amountFils: number; note: string; createdAt: string }[];
  commissionPct: number;
};

function Ledger() {
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<LedgerData | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/driver/ledger?from=${from}&to=${to}`);
      if (res.ok) setData(await res.json());
    })();
  }, [from, to]);

  return (
    <div className="print-area">
      <Label>السجل المالي</Label>
      <h1 className="font-display text-3xl font-extrabold text-white">الأرباح والمدفوعات</h1>

      <Card dark className="mb-5 mt-5 p-5 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="من">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={darkInputCls} />
          </Field>
          <Field label="إلى">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={darkInputCls} />
          </Field>
          <Btn
            variant="gold"
            onClick={() => {
              if (!data) return;
              downloadFile(
                `luqma-driver-ledger-${from}-${to}.csv`,
                toCsv(
                  data.rows.map((r) => ({
                    التاريخ: fmtDateTime(r.placedAt),
                    الطلب: r.code,
                    الحالة: r.status,
                    المتجر: r.storeName ?? "",
                    رسوم_التوصيل: (r.deliveryFeeFils / 1000).toFixed(3),
                    عمولة_المنصّة: ((r.deliveryFeeFils * r.deliveryCommissionPct) / 100 / 1000).toFixed(3),
                    حصة_المندوب: ((r.driverEarningsFils ?? 0) / 1000).toFixed(3),
                  })),
                  [],
                ),
              );
            }}
          >
            ⬇ تصدير Excel (CSV)
          </Btn>
          <Btn variant="outlineLight" onClick={() => window.print()}>
            🖨 حفظ PDF
          </Btn>
        </div>
      </Card>

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat dark label="طلبات مكتملة" value={String(data.totals.delivered)} sub={`من ${data.totals.orders} طلب`} />
            <Stat dark label="إجمالي المستحقات" value={fmtFils(data.totals.duesFils)} accent />
            <Stat dark label="المدفوع" value={fmtFils(data.totals.paidFils)} />
            <Stat dark label="الرصيد المتبقي" value={fmtFils(data.totals.remainingFils)} />
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[680px] text-right text-sm">
              <thead className="bg-white/5 text-[11px] uppercase tracking-[0.16em] text-[#FDBA21]">
                <tr>
                  <th className="px-4 py-3">التاريخ</th>
                  <th className="px-4 py-3">الطلب</th>
                  <th className="px-4 py-3">المتجر</th>
                  <th className="px-4 py-3">رسوم التوصيل</th>
                  <th className="px-4 py-3">عمولة المنصّة</th>
                  <th className="px-4 py-3">حصتي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 tabular-nums text-white/85">
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">{fmtDateTime(r.placedAt)}</td>
                    <td className="px-4 py-3">{r.code}</td>
                    <td className="px-4 py-3">{r.storeName}</td>
                    <td className="px-4 py-3">{fmtFils(r.deliveryFeeFils)}</td>
                    <td className="px-4 py-3 text-[#FDBA21]">
                      {fmtFils(Math.round((r.deliveryFeeFils * r.deliveryCommissionPct) / 100))}
                    </td>
                    <td className="px-4 py-3 font-bold">{fmtFils(r.driverEarningsFils ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.rows.length && <Empty dark text="لا توجد حركة في هذه الفترة" />}
          </div>

          <h2 className="mt-8 mb-3 font-display text-xl font-extrabold text-[#FDBA21]">المدفوعات</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[520px] text-right text-sm">
              <thead className="bg-white/5 text-[11px] uppercase tracking-[0.16em] text-[#FDBA21]">
                <tr>
                  <th className="px-4 py-3">التاريخ</th>
                  <th className="px-4 py-3">المبلغ</th>
                  <th className="px-4 py-3">البيان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-white/85">
                {data.payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{fmtDate(p.createdAt)}</td>
                    <td className="px-4 py-3 tabular-nums font-bold">{fmtFils(p.amountFils)}</td>
                    <td className="px-4 py-3 text-white/55">{p.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
