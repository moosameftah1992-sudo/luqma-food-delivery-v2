"use client";

import { useCallback, useEffect, useState } from "react";
import { Gift, KeyRound, ShieldCheck, History, ArrowUpRight } from "lucide-react";
import { Btn, Spinner } from "@/components/ui";
import { useLocale } from "@/components/locale-provider";
import { fmtDateTime, fmtFils } from "@/lib/util";

type BonusEntry = {
  id: number;
  amountFils: number;
  note: string;
  createdAt: string;
  adminName: string | null;
};

export function AdminCustomerTools({
  customerId,
  onBalanceChanged,
  toast,
}: {
  customerId: number;
  onBalanceChanged: (balance: number) => void;
  toast: (message: string, tone?: "ok" | "err") => void;
}) {
  const { tr } = useLocale();
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState<BonusEntry[]>([]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"bonus" | "password" | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/bonus`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تحميل رصيد العميل");
      setBalance(payload.customer.bonusBalanceFils);
      setEntries(payload.entries);
      onBalanceChanged(payload.customer.bonusBalanceFils);
    } catch (error) {
      toast(error instanceof Error ? error.message : "تعذر تحميل رصيد العميل", "err");
    } finally { setLoading(false); }
  }, [customerId, onBalanceChanged, toast]);
  useEffect(() => { void load(); }, [load]);

  const giveBonus = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (!/^\d{1,5}(?:\.\d{1,3})?$/.test(amount)) return toast(tr("أدخل مبلغاً صحيحاً بثلاث خانات عشرية كحد أقصى", "Enter a valid amount with up to three decimals"), "err");
    const amountFils = Math.round(Number(amount) * 1000);
    if (amountFils < 1 || amountFils > 10_000_000) return toast(tr("المبلغ خارج الحد المسموح", "Amount exceeds the permitted limit"), "err");
    if (reason.trim().length < 3) return toast(tr("اكتب سبب المنحة", "Enter a reason for this bonus"), "err");
    setSaving("bonus");
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/bonus`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountFils, note: reason.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر إضافة البونس");
      setBalance(payload.balanceFils);
      onBalanceChanged(payload.balanceFils);
      setAmount(""); setReason("");
      toast(tr("أُضيف البونس إلى رصيد العميل", "Bonus added to customer balance"));
      void load();
    } catch (error) { toast(error instanceof Error ? error.message : "تعذر الاتصال", "err"); }
    finally { setSaving(null); }
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (password.length < 12 || password.length > 128) return toast(tr("كلمة المرور الجديدة يجب أن تكون بين 12 و128 حرفاً", "Password must have 12–128 characters"), "err");
    if (password !== confirm) return toast(tr("تأكيد كلمة المرور غير مطابق", "Passwords do not match"), "err");
    setSaving("password");
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تغيير كلمة المرور");
      setPassword(""); setConfirm("");
      toast(tr("تم تحديث كلمة مرور العميل بأمان", "Customer password updated securely"));
    } catch (error) { toast(error instanceof Error ? error.message : "تعذر الاتصال", "err"); }
    finally { setSaving(null); }
  };

  if (loading) return <Spinner label={tr("جاري تحميل رصيد العميل…", "Loading customer balance…")} />;
  return <div className="grid gap-4 lg:grid-cols-2">
    <section className="rounded-2xl border border-[#281044]/10 bg-[#f9f5ee] p-5">
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-display text-lg font-extrabold text-[#281044]"><Gift size={20} className="text-[#bf7f13]" />{tr("هدية / بونس للعميل", "Customer gift / bonus")}</div><span className="rounded-xl bg-[#281044] px-3 py-1.5 text-xs font-bold text-[#ffc531]">{fmtFils(balance)}</span></div>
      <p className="mt-2 text-xs leading-5 text-[#70647b]">{tr("المنحة تُحفظ في رصيد العميل ويُوثَّق سببها والمدير الذي أضافها.", "This amount is recorded in the customer's balance along with its reason and issuing administrator.")}</p>
      <form onSubmit={giveBonus} className="mt-4 space-y-3">
        <label className="block space-y-1 text-xs font-bold text-[#625572]">{tr("المبلغ بالدينار البحريني", "Amount in BHD")}<input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0.001" max="10000" step="0.001" placeholder="1.000" required dir="ltr" className="mt-1 w-full rounded-xl border border-[#281044]/15 bg-white px-3 py-2.5 text-sm text-[#281044] outline-none focus:border-[#ffc531]" /></label>
        <label className="block space-y-1 text-xs font-bold text-[#625572]">{tr("سبب المنحة", "Bonus reason")}<input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={250} minLength={3} required placeholder={tr("مثلاً: اعتذار عن تأخير الطلب", "For example: apology for delayed order")} className="mt-1 w-full rounded-xl border border-[#281044]/15 bg-white px-3 py-2.5 text-sm text-[#281044] outline-none focus:border-[#ffc531]" /></label>
        <Btn type="submit" disabled={Boolean(saving)} className="w-full">{saving === "bonus" ? tr("جارٍ الحفظ…", "Saving…") : tr("إضافة المبلغ إلى الحساب", "Add amount to account")}</Btn>
      </form>
      <div className="mt-5 border-t border-[#281044]/10 pt-4"><p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#281044]"><History size={14} />{tr("سجل الهدايا", "Gift history")}</p><div className="max-h-40 space-y-2 overflow-auto">{entries.length ? entries.map((entry) => <div key={entry.id} className="flex items-start justify-between gap-2 rounded-lg bg-white p-2.5 text-xs"><div><p className="font-bold text-[#281044]">{entry.note}</p><p className="mt-1 text-[#81758c]">{entry.adminName || "—"} · {fmtDateTime(entry.createdAt)}</p></div><span className="shrink-0 font-bold text-emerald-700">+{fmtFils(entry.amountFils)}</span></div>) : <p className="text-xs text-[#81758c]">{tr("لا توجد منح سابقة", "No previous bonuses")}</p>}</div></div>
    </section>
    <section className="rounded-2xl border border-[#281044]/10 bg-white p-5">
      <div className="flex items-center gap-2 font-display text-lg font-extrabold text-[#281044]"><KeyRound size={20} className="text-[#bf7f13]" />{tr("إعادة تعيين كلمة مرور العميل", "Reset customer password")}</div>
      <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-[#70647b]"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" />{tr("لن تظهر كلمة المرور القديمة أو الجديدة في سجلات الحساب. شارك كلمة المرور الجديدة مع العميل بأمان.", "Current and new passwords are never shown in account records. Share the new password securely with the customer.")}</p>
      <form onSubmit={changePassword} className="mt-4 space-y-3">
        <label className="block space-y-1 text-xs font-bold text-[#625572]">{tr("كلمة المرور الجديدة", "New password")}<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-[#281044]/15 bg-white px-3 py-2.5 text-sm text-[#281044] outline-none focus:border-[#ffc531]" dir="ltr" /></label>
        <label className="block space-y-1 text-xs font-bold text-[#625572]">{tr("تأكيد كلمة المرور", "Confirm password")}<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-1 w-full rounded-xl border border-[#281044]/15 bg-white px-3 py-2.5 text-sm text-[#281044] outline-none focus:border-[#ffc531]" dir="ltr" /></label>
        <Btn type="submit" variant="ink" disabled={Boolean(saving)} className="w-full">{saving === "password" ? tr("جارٍ التغيير…", "Updating…") : tr("تحديث كلمة المرور", "Update password")}</Btn>
      </form>
    </section>
  </div>;
}
