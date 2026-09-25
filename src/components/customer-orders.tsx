"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CustomerChrome, type GovOpt } from "@/components/customer-home";
import { Btn, Card, Empty, Field, Modal, Pill, Price, Spinner, inputCls, Tabs } from "@/components/ui";
import { useLiveList, useToast } from "@/components/alert";
import { fmtDateTime, fmtFils, ORDER_STATUS_AR, ORDER_STATUS_TONE, cn } from "@/lib/util";
import type { Brand } from "@/lib/brand";

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
  storeName: string | null;
  subtotalFils: number;
  deliveryFeeFils: number;
  discountFils: number;
  totalFils: number;
  bonusUsedFils: number;
  paymentStatus: string;
  paymentMethod: string;
  cardLast4: string | null;
  paymentRef: string | null;
  address: string;
  note: string;
  cancelReason: string | null;
  placedAt: string;
  items: Line[];
};

export function OrdersView({
  brand,
  logoOverride,
  userName,
  gov,
}: {
  brand: Brand;
  logoOverride?: string;
  userName?: string | null;
  gov: GovOpt[];
}) {
  const { items: orders, refresh, loading } = useLiveList<Order>("/api/orders?scope=customer", 6000, {
    silent: true,
  });
  const [tab, setTab] = useState("active");
  const [cancelFor, setCancelFor] = useState<Order | null>(null);
  const [reviewFor, setReviewFor] = useState<Order | null>(null);
  const [reason, setReason] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [, tick] = useState(0);
  const toast = useToast();

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeStatuses = ["pending", "accepted", "ready", "assigned", "onway"];
  const filtered = orders.filter((o) =>
    tab === "active"
      ? activeStatuses.includes(o.status)
      : tab === "done"
        ? o.status === "delivered"
        : !activeStatuses.includes(o.status) && o.status !== "delivered",
  );

  const minutesLeft = (o: Order) => {
    const left = 5 - (Date.now() - new Date(o.placedAt).getTime()) / 60000;
    return Math.max(0, Math.ceil(left));
  };

  const doCancel = async () => {
    if (!cancelFor) return;
    const res = await fetch(`/api/orders/${cancelFor.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", reason }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.show("تم إلغاء الطلب");
      setCancelFor(null);
      setReason("");
      refresh();
    } else toast.show(data.error || "تعذر الإلغاء", "err");
  };

  const doReview = async () => {
    if (!reviewFor) return;
    const res = await fetch(`/api/orders/${reviewFor.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.show("شكراً لتقييمك!");
      setReviewFor(null);
      setComment("");
      refresh();
    } else toast.show(data.error || "تعذر التقييم", "err");
  };

  return (
    <CustomerChrome brand={brand} logoOverride={logoOverride} userName={userName}>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-4xl font-extrabold text-[#2A0A4A]">طلباتي</h1>
        <p className="mt-1 text-sm text-[#6B5E7A]">
          يمكنك إلغاء الطلب خلال {brand.cancelWindowMin} دقائق من لحظة تسجيله مع ذكر السبب.
        </p>

        <Tabs
          className="mt-6"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "active", label: "جارية" },
            { key: "done", label: "مكتملة" },
            { key: "other", label: "ملغاة / مرفوضة" },
          ]}
        />

        {loading && <Spinner />}
        {!loading && filtered.length === 0 && <Empty text="لا توجد طلبات في هذا القسم بعد" />}

        <div className="space-y-5">
          {filtered.map((o) => {
            const left = minutesLeft(o);
            const canCancel = activeStatuses.includes(o.status) && left > 0 && ["captured", "cash_due"].includes(o.paymentStatus);
            return (
              <Card key={o.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-[#2A0A4A]/20 px-5 py-4">
                  <div>
                    <p className="font-display text-lg font-extrabold text-[#2A0A4A]">{o.storeName}</p>
                    <p className="text-xs text-[#6B5E7A] tabular-nums">
                      {o.code} · {fmtDateTime(o.placedAt)}
                    </p>
                  </div>
                  <Pill className={cn("border", ORDER_STATUS_TONE[o.status] ?? "")}>
                    {ORDER_STATUS_AR[o.status] ?? o.status}
                  </Pill>
                </div>

                <ul className="px-5 py-3 text-sm">
                  {o.items.map((l) => (
                    <li key={l.id} className="flex items-start justify-between gap-3 py-1.5">
                      <span>
                        <span className="font-bold tabular-nums">{l.qty}×</span> {l.nameAr}
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

                <div className="grid gap-3 border-t border-dashed border-[#2A0A4A]/20 px-5 py-4 text-xs text-[#6B5E7A] sm:grid-cols-2">
                  <p>العنوان: {o.address || "—"}</p>
                  <p>
                    الدفع:{" "}
                    <span className="font-bold text-[#2A0A4A]">
                      {o.paymentMethod === "cash" ? "نقداً عند الاستلام" : o.paymentMethod === "card"
                        ? `بطاقة تنتهي بـ ${o.cardLast4 ?? "••••"}`
                        : "بنفت باي"}
                    </span>{o.paymentRef ? ` · مرجع ${o.paymentRef}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-3 font-bold sm:col-span-2">
                    <span>المجموع {fmtFils(o.subtotalFils)}</span>
                    <span>التوصيل {fmtFils(o.deliveryFeeFils)}</span>
                    {o.discountFils > 0 && <span>الخصم −{fmtFils(o.discountFils)}</span>}
                    {o.bonusUsedFils > 0 && <span className="text-emerald-700">البونس المستخدم −{fmtFils(o.bonusUsedFils)}</span>}
                    <span className="text-[#B4520A]">الإجمالي {fmtFils(o.totalFils)}</span>
                    <span>{o.paymentMethod === "cash" ? (o.paymentStatus === "cash_due" ? "المطلوب نقداً" : "نقداً بعد البونس") : "الجزء المسدد إلكترونياً"} {fmtFils(Math.max(0, o.totalFils - (o.bonusUsedFils || 0)))}</span>
                  </div>
                  {o.cancelReason && (
                    <p className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-rose-700">
                      سبب الإلغاء: {o.cancelReason}
                    </p>
                  )}
                  {o.paymentStatus === "refund_pending" && (
                    <p className="sm:col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">طلب استرداد الجزء المدفوع إلكترونياً قيد المعالجة لدى بوابة الدفع.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-[#2A0A4A]/10 px-5 py-4">
                  {canCancel && (
                    <Btn
                      variant="danger"
                      onClick={() => {
                        setCancelFor(o);
                        setReason("");
                      }}
                    >
                      إلغاء الطلب ({left} د متبقية)
                    </Btn>
                  )}
                  {o.status === "delivered" && (
                    <Btn variant="outline" onClick={() => setReviewFor(o)}>
                      قيّم المطعم
                    </Btn>
                  )}
                  <Link href="/#restaurants">
                    <Btn variant="ghost">اطلب مجدداً</Btn>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Modal open={!!cancelFor} onClose={() => setCancelFor(null)} title="إلغاء الطلب">
        <div className="space-y-4">
          <p className="text-sm text-[#6B5E7A]">
            الإلغاء متاح فقط خلال {brand.cancelWindowMin} دقائق من تسجيل الطلب. يلزم ذكر السبب.
          </p>
          <Field label="سبب الإلغاء (إلزامي)">
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputCls}
              required
            >
              <option value="">اختر السبب…</option>
              <option>طلبت بالخطأ</option>
              <option>وقت التوصيل طويل</option>
              <option>وجدت مطعماً آخر</option>
              <option>مشكلة في الدفع</option>
              <option>سبب آخر</option>
            </select>
          </Field>
          <div className="flex gap-3">
            <Btn variant="danger" disabled={!reason} onClick={doCancel} className="flex-1">
              تأكيد الإلغاء
            </Btn>
            <Btn variant="outline" onClick={() => setCancelFor(null)}>
              تراجع
            </Btn>
          </div>
        </div>
      </Modal>

      <Modal open={!!reviewFor} onClose={() => setReviewFor(null)} title="تقييم المطعم">
        <div className="space-y-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className={cn(
                  "text-3xl transition",
                  n <= rating ? "text-[#FDBA21]" : "text-[#2A0A4A]/20",
                )}
                aria-label={`${n} نجوم`}
              >
                ★
              </button>
            ))}
          </div>
          <Field label="تعليقك">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className={inputCls}
              placeholder="كيف كانت جودة الطعام والسرعة؟"
            />
          </Field>
          <Btn onClick={doReview} className="w-full">
            إرسال التقييم
          </Btn>
        </div>
      </Modal>
      {toast.node}
    </CustomerChrome>
  );
}
