"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, PackageCheck, Store } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { StoreStatusSelector, WorkingHoursEditor, type StoreManualStatus } from "@/components/store-schedule-controls";
import { Btn, Spinner } from "@/components/ui";
import { effectiveStoreStatus, parseWorkingHours, type WorkingPeriod } from "@/lib/working-hours";
import { fmtFils } from "@/lib/util";

type StoreInfo = {
  id: number;
  nameAr: string;
  nameEn: string | null;
  status: string;
  workingHours: WorkingPeriod[];
};

type ItemInfo = {
  id: number;
  storeId: number;
  nameAr: string;
  nameEn: string | null;
  priceFils: number;
  available: boolean;
};

export function AdminStoreOperations({
  storeId,
  onStoreChanged,
  toast,
}: {
  storeId: number;
  onStoreChanged: (status: StoreManualStatus) => void;
  toast: (message: string, tone?: "ok" | "err") => void;
}) {
  const { locale, tr } = useLocale();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [hours, setHours] = useState<WorkingPeriod[]>([]);
  const [items, setItems] = useState<ItemInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/stores/${storeId}/operations`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر جلب بيانات المتجر");
      setStore(data.store);
      setHours(Array.isArray(data.store.workingHours) ? data.store.workingHours : []);
      setItems(data.items);
    } catch (error) {
      toast(error instanceof Error ? error.message : "تعذر الاتصال", "err");
    } finally {
      setLoading(false);
    }
  }, [storeId, toast]);

  useEffect(() => { void load(); }, [load]);

  const changeStatus = async (next: StoreManualStatus) => {
    if (!store || store.status === next || busyAction) return;
    setBusyAction("status");
    try {
      const response = await fetch(`/api/admin/stores/${storeId}/operations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", status: next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر تغيير الحالة");
      setStore((previous) => previous ? { ...previous, status: result.status } : previous);
      toast(tr("تم تحديث حالة المتجر", "Restaurant status updated"));
      onStoreChanged(next);
    } catch (error) {
      toast(error instanceof Error ? error.message : "تعذر الاتصال", "err");
    } finally {
      setBusyAction(null);
    }
  };

  const saveHours = async () => {
    if (!store || busyAction) return;
    const validated = parseWorkingHours(hours);
    if (!validated.ok) return toast(validated.error, "err");
    setBusyAction("hours");
    try {
      const response = await fetch(`/api/admin/stores/${storeId}/operations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hours", workingHours: validated.periods }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر حفظ الفترات");
      setStore((previous) => previous ? { ...previous, workingHours: result.workingHours } : previous);
      setHours(result.workingHours);
      toast(tr("حُفظت أوقات عمل المتجر", "Restaurant hours saved"));
    } catch (error) {
      toast(error instanceof Error ? error.message : "تعذر الاتصال", "err");
    } finally {
      setBusyAction(null);
    }
  };

  const changeAvailability = async (item: ItemInfo) => {
    if (busyAction) return;
    setBusyAction(`item-${item.id}`);
    try {
      const response = await fetch(`/api/admin/stores/${storeId}/operations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "availability", itemId: item.id, available: !item.available }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر تغيير حالة الصنف");
      setItems((previous) => previous.map((row) => row.id === item.id ? { ...row, available: result.available } : row));
      toast(result.available ? tr("الصنف متوفر الآن", "Item is now available") : tr("الصنف غير متوفر الآن", "Item is now unavailable"));
    } catch (error) {
      toast(error instanceof Error ? error.message : "تعذر الاتصال", "err");
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) return <Spinner label={tr("جارٍ تحميل إعدادات التشغيل…", "Loading restaurant operations…")} />;
  if (!store) return <p className="text-sm text-rose-700">{tr("تعذر عرض إعدادات المتجر", "Unable to display restaurant settings")}</p>;

  const effective = effectiveStoreStatus(store.status, store.workingHours);
  const effectiveLabel = effective === "open" ? tr("مفتوح", "Open") : effective === "busy" ? tr("مشغول", "Busy") : tr("مغلق", "Closed");
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-[#281044] p-4 text-white sm:p-5">
        <div className="mb-3 flex items-center gap-2"><Store size={18} className="text-[#ffc531]" /><h4 className="font-display text-lg font-extrabold">{tr("تشغيل المتجر", "Restaurant operations")}</h4></div>
        <StoreStatusSelector value={store.status} onChange={(next) => void changeStatus(next)} disabled={Boolean(busyAction)} />
        <p className="mt-3 text-xs leading-5 text-white/65">
          {tr("الحالة الظاهرة للعملاء الآن:", "Currently shown to customers:")} <strong className="text-[#ffc531]">{effectiveLabel}</strong>
          {store.workingHours.length ? tr(" · تغلق ساعات العمل المتجر خارج فتراته، وتبقى الحالة اليدوية قابلة للتعديل في أي وقت.", " · The schedule closes the restaurant outside opening periods. You can change its manual status at any time.") : ""}
        </p>
      </div>

      <div className="rounded-2xl bg-[#281044] p-4 text-white sm:p-5">
        <div className="mb-4 flex items-center gap-2"><Clock3 size={18} className="text-[#ffc531]" /><h4 className="font-display text-lg font-extrabold">{tr("جدول أوقات العمل", "Opening hours schedule")}</h4></div>
        <WorkingHoursEditor value={hours} onChange={setHours} />
        <Btn onClick={() => void saveHours()} disabled={Boolean(busyAction)} className="mt-5 w-full sm:w-auto">
          {busyAction === "hours" ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ أوقات العمل", "Save opening hours")}
        </Btn>
      </div>

      <div className="rounded-2xl bg-[#281044] p-4 text-white sm:p-5">
        <div className="mb-3 flex items-center gap-2"><PackageCheck size={18} className="text-[#ffc531]" /><h4 className="font-display text-lg font-extrabold">{tr("توفر الأصناف", "Menu item availability")}</h4></div>
        <p className="mb-4 text-xs text-white/55">{tr("كل صنف مستقل؛ لا يتأثر سعره أو موافقات تعديل الأسعار عند تغيير توفره.", "Each item is independent. Changing availability does not change prices or price approvals.")}</p>
        {items.length ? (
          <div className="max-h-72 divide-y divide-white/10 overflow-y-auto rounded-xl border border-white/10 px-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-bold">{locale === "en" ? item.nameEn || item.nameAr : item.nameAr}</p><p className="text-xs text-white/50">{fmtFils(item.priceFils)}</p></div>
                <button
                  type="button"
                  disabled={Boolean(busyAction)}
                  aria-pressed={item.available}
                  onClick={() => void changeAvailability(item)}
                  className={item.available
                    ? "shrink-0 rounded-full bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/35 disabled:opacity-50"
                    : "shrink-0 rounded-full bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-300 transition hover:bg-rose-500/35 disabled:opacity-50"}
                >
                  {item.available ? tr("متوفر", "Available") : tr("غير متوفر", "Unavailable")}
                </button>
              </div>
            ))}
          </div>
        ) : <p className="rounded-xl border border-dashed border-white/20 py-6 text-center text-sm text-white/55">{tr("لا توجد أصناف مضافة لهذا المتجر", "No items have been added to this restaurant yet")}</p>}
      </div>
    </div>
  );
}
