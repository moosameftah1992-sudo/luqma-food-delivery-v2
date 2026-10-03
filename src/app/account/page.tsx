"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header, Footer, WhatsAppFab, Btn, Field, inputCls, Modal, Badge, Spinner, Empty, StatusBadge } from "@/components/ui";
import { useL, fmtNum, fmtDate } from "@/lib/i18n";

export default function AccountPage() {
  const router = useRouter();
  const { s, lang } = useL();
  const [me, setMe] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"orders" | "addresses" | "profile">("orders");
  const [addrModal, setAddrModal] = useState(false);
  const [cancelModal, setCancelModal] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [na, setNa] = useState({ label: "", line: "", governorateId: "", areaId: "" });

  const load = async () => {
    const [m, o] = await Promise.all([
      fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "me" }) }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/orders?scope=customer").then((r) => (r.ok ? r.json() : { orders: [] })),
    ]);
    if (!m) {
      router.replace("/auth/login?next=/account");
      return;
    }
    setMe(m);
    setOrders(o.orders || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add-address", ...na, isDefault: !me?.addresses?.some((a: any) => a.isDefault) }) });
    const j = await r.json();
    if (j.error) setErr(j.error);
    else setAddrModal(false);
    setBusy(false);
    load();
  };

  const cancelOrder = async () => {
    setBusy(true);
    setErr("");
    const r = await fetch(`/api/orders/${cancelModal.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "customer-cancel", reason: cancelReason }) });
    const j = await r.json();
    if (j.error) setErr(j.error);
    setCancelModal(null);
    setCancelReason("");
    setBusy(false);
    load();
  };

  const logout = async () => {
    await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout", role: "customer" }) });
    router.push("/");
  };

  if (loading || !me) {
    return <div className="grid min-h-screen place-items-center bg-royal-950"><Spinner light /></div>;
  }

  const canCancel = (o: any) => {
    const age = (Date.now() - new Date(o.placedAt).getTime()) / 60000;
    return age <= 5 && ["pending", "accepted"].includes(o.status);
  };

  return (
    <div className="min-h-screen">
      <Header user={{ name: me.user.name, bonus: me.user.bonusBalance }} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-royal-950">{s("حسابي", "My account")}</h1>
          <Btn variant="outline" onClick={logout}>{s("تسجيل الخروج", "Log out")}</Btn>
        </div>

        {/* bonus + profile cards */}
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 p-5 text-royal-950 shadow-lg">
            <p className="text-xs font-black opacity-70">{s("رصيد البونس", "Bonus balance")}</p>
            <p className="mt-1 text-3xl font-black">{fmtNum(me.user.bonusBalance)}</p>
            <p className="mt-1 text-[10px] font-bold opacity-70">{s("يُخصم تلقائياً عند إتمام الطلب", "Applied automatically at checkout")}</p>
          </div>
          <div className="rounded-2xl border border-royal-100 bg-white p-5 sm:col-span-2">
            <p className="text-xs font-black text-royal-400">{s("بياناتك", "Your profile")}</p>
            <p className="mt-1 text-lg font-black text-royal-950">{me.user.name}</p>
            <p className="text-xs text-gray-500" dir="ltr" style={{ textAlign: "start" }}>{me.user.email}{me.user.phone && ` · ${me.user.phone}`}</p>
          </div>
        </div>

        {err && <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-600">{err}</div>}

        <div className="mt-6 flex gap-2">
          {([["orders", s("طلباتي", "My orders")], ["addresses", s("عناويني", "My addresses")], ["profile", s("الأمان", "Security")]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k as any)} className={`rounded-full px-4 py-2 text-xs font-black transition ${tab === k ? "bg-royal-900 text-white" : "bg-white border border-royal-150 text-royal-700"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "orders" && (
          <div className="mt-5 space-y-3">
            {orders.length === 0 && <Empty text={s("لا توجد طلبات بعد", "No orders yet")} />}
            {orders.map((o) => (
              <div key={o.id} className="overflow-hidden rounded-2xl border border-royal-100 bg-white">
                <button className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-start" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                  <div>
                    <p className="text-sm font-black text-royal-950">{o.store?.nameAr || s("مطعم", "Restaurant")} <span className="text-[10px] font-bold text-gray-400" dir="ltr">{o.orderNo}</span></p>
                    <p className="text-[11px] text-gray-500">{fmtDate(o.placedAt, lang)} · {s("الإجمالي", "Total")}: {fmtNum(o.total)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canCancel(o) && <Btn variant="danger" className="px-3 py-1.5 text-[11px]" onClick={(e) => { e.stopPropagation(); setCancelModal(o); }}>{s("إلغاء الطلب", "Cancel")}</Btn>}
                    <StatusBadge status={o.status} />
                  </div>
                </button>
                {expanded === o.id && (
                  <div className="border-t border-royal-100 bg-royal-50/40 px-4 py-3 text-xs">
                    <div className="space-y-1.5">
                      {(o.items || []).map((it: any, i: number) => (
                        <div key={i} className="flex justify-between">
                          <span className="font-bold text-royal-800">{it.nameAr || it.name} × {it.qty}</span>
                          <span className="font-black">{fmtNum(it.lineTotal || it.unitPrice * it.qty)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold text-gray-500">
                      <span>{s("الدفع", "Payment")}: {o.paymentMethod === "cod" ? s("نقداً", "COD") : o.paymentMethod}</span>
                      <span>{s("التوصيل", "Delivery")}: {fmtNum(o.deliveryFee)}</span>
                      {Number(o.bonusUsed) > 0 && <span className="text-gold-700">{s("بونس مستخدم", "Bonus used")}: −{fmtNum(o.bonusUsed)}</span>}
                      {o.driver && <span className="text-emerald-600">{s("المندوب", "Driver")}: {o.driver.name}</span>}
                      {o.cancelledReason && <span className="text-red-500">{s("سبب الإلغاء", "Cancelled")}: {o.cancelledReason}</span>}
                    </div>
                    {/* mini timeline */}
                    <div className="mt-3 flex items-center gap-1">
                      {["pending", "accepted", "preparing", "ready", "out_for_delivery", "delivered"].map((st, i) => {
                        const order = ["pending", "accepted", "preparing", "ready", "out_for_delivery", "delivered"];
                        const reached = o.status === "cancelled" ? false : order.indexOf(o.status) >= i;
                        return (
                          <div key={st} className={`h-1.5 flex-1 rounded-full ${reached ? "bg-gold-500" : "bg-royal-100"}`} />
                        );
                      })}
                    </div>
                    {o.status === "cancelled" && <div className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600">{s("سبب الإلغاء", "Reason")}: {o.cancelledReason}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "addresses" && (
          <div className="mt-5 space-y-3">
            <div className="flex justify-end"><Btn onClick={() => setAddrModal(true)}>{s("+ عنوان جديد", "+ New address")}</Btn></div>
            {me.addresses.length === 0 && <Empty text={s("لا توجد عناوين", "No addresses")} />}
            {me.addresses.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-2xl border border-royal-100 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-black text-royal-950">{a.label} {a.isDefault && <Badge tone="gold">{s("افتراضي", "Default")}</Badge>}</p>
                  <p className="text-xs text-gray-500">{a.line}</p>
                </div>
                <div className="flex gap-2">
                  {!a.isDefault && <Btn variant="outline" className="px-3 py-1.5 text-[11px]" onClick={async () => { await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-default-address", id: a.id }) }); load(); }}>{s("افتراضياً", "Set default")}</Btn>}
                  <Btn variant="danger" className="px-3 py-1.5 text-[11px]" onClick={async () => { await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete-address", id: a.id }) }); load(); }}>×</Btn>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "profile" && (
          <div className="mt-5 rounded-2xl border border-royal-100 bg-white p-5 text-xs leading-relaxed text-gray-600">
            <h3 className="text-sm font-black text-royal-950">{s("الأمان وكلمة المرور", "Security & password")}</h3>
            <p className="mt-2">
              {s("يمكنك في أي وقت استعادة كلمة مرورك بنفسك عبر صفحة \"نسيت كلمة المرور\" — تصلك رابط إعادة التعيين على بريدك دون الحاجة لأي تدخل إداري.", "You can always recover your password yourself via \"Forgot password\" — a reset link is emailed to you with no admin intervention.")}
            </p>
            <a href="/auth/forgot" className="mt-3 inline-block rounded-xl bg-royal-900 px-4 py-2 font-black text-white hover:bg-royal-800">{s("استعادة كلمة المرور", "Recover password")}</a>
          </div>
        )}
      </main>

      <Modal open={addrModal} onClose={() => setAddrModal(false)} title={s("إضافة عنوان", "Add address")}>
        <form onSubmit={addAddress} className="space-y-3">
          <Field label={s("اسم العنوان", "Label (Home, Office…)")}>
            <input className={inputCls} value={na.label} onChange={(e) => setNa((p) => ({ ...p, label: e.target.value }))} required />
          </Field>
          <Field label={s("التفاصيل: الشارع، البناية، أقرب معلم", "Details")}>
            <input className={inputCls} value={na.line} onChange={(e) => setNa((p) => ({ ...p, line: e.target.value }))} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={s("المحافظة", "Governorate")}>
              <input className={inputCls} list="govs" value={na.governorateId} onChange={(e) => setNa((p) => ({ ...p, governorateId: e.target.value }))} placeholder="— " />
              <datalist id="govs">
                {["العاصمة", "المحرق", "الشمالية", "الجنوبية", "المنطقة الجنوبية الغربية"].map((g) => <option key={g} value={g} />)}
              </datalist>
            </Field>
            <Field label={s("المنطقة", "Area")}>
              <input className={inputCls} value={na.areaId} onChange={(e) => setNa((p) => ({ ...p, areaId: e.target.value }))} placeholder="— " />
            </Field>
          </div>
          <Btn type="submit" className="w-full" disabled={busy}>{busy ? <Spinner /> : s("حفظ العنوان", "Save address")}</Btn>
        </form>
      </Modal>

      <Modal open={!!cancelModal} onClose={() => setCancelModal(null)} title={s("إلغاء الطلب", "Cancel order")}>
        <div className="space-y-3">
          <p className="text-xs text-gray-500">{s("الإلغاء متاح خلال 5 دقائق فقط من تقديم الطلب مع سبب إلزامي.", "Cancellations are only allowed within 5 minutes and require a reason.")}</p>
          <textarea className={inputCls} rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder={s("سبب الإلغاء (إلزامي)", "Reason (required)")} />
          <Btn variant="danger" className="w-full" disabled={busy || !cancelReason.trim()} onClick={cancelOrder}>{busy ? <Spinner /> : s("تأكيد الإلغاء", "Confirm cancellation")}</Btn>
        </div>
      </Modal>

      <Footer />
      <WhatsAppFab />
    </div>
  );
}
