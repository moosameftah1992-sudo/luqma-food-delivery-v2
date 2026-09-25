"use client";

import { Clock3, Copy, Plus, Trash2 } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { WEEKDAYS_AR, WEEKDAYS_EN, type WorkingPeriod } from "@/lib/working-hours";
import { cn } from "@/lib/util";

export type StoreManualStatus = "open" | "busy" | "closed";

const STATUS_OPTIONS: { value: StoreManualStatus; ar: string; en: string; color: string }[] = [
  { value: "open", ar: "مفتوح", en: "Open", color: "bg-emerald-400" },
  { value: "busy", ar: "مشغول", en: "Busy", color: "bg-amber-400" },
  { value: "closed", ar: "مغلق", en: "Closed", color: "bg-rose-400" },
];

export function StoreStatusSelector({
  value,
  onChange,
  disabled = false,
  dark = true,
}: {
  value: string;
  onChange: (next: StoreManualStatus) => void;
  disabled?: boolean;
  dark?: boolean;
}) {
  const { tr } = useLocale();
  return (
    <div
      role="group"
      aria-label={tr("حالة المتجر", "Restaurant status")}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-xl border p-1",
        dark ? "border-white/15 bg-white/5" : "border-[#281044]/15 bg-[#f5eff9]",
      )}
    >
      {STATUS_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors sm:px-3 sm:text-xs disabled:cursor-wait disabled:opacity-60",
            value === option.value
              ? "bg-[#ffc531] text-[#281044] shadow-sm"
              : dark
                ? "text-white/70 hover:bg-white/10 hover:text-white"
                : "text-[#5f5270] hover:bg-white",
          )}
        >
          <span className={cn("h-2 w-2 shrink-0 rounded-full", option.color)} aria-hidden="true" />
          {tr(option.ar, option.en)}
        </button>
      ))}
    </div>
  );
}

export function WorkingHoursEditor({
  value,
  onChange,
}: {
  value: WorkingPeriod[];
  onChange: (periods: WorkingPeriod[]) => void;
}) {
  const { locale, tr } = useLocale();
  const setPeriod = (index: number, field: "from" | "to", time: string) => {
    onChange(value.map((period, i) => i === index ? { ...period, [field]: time } : period));
  };
  const addPeriod = (day: number) => {
    const existing = value.filter((period) => period.day === day);
    if (existing.length >= 8) return;
    const last = existing.at(-1);
    const from = last?.to ?? "09:00";
    const fromHour = Number(from.slice(0, 2));
    const to = last ? `${String((fromHour + 3) % 24).padStart(2, "0")}:${from.slice(3)}` : "22:00";
    onChange([...value, { day, from, to }]);
  };
  const copyToWeek = (day: number) => {
    const sample = value.filter((period) => period.day === day);
    if (!sample.length) return;
    onChange(Array.from({ length: 7 }, (_, target) =>
      sample.map((period) => ({ ...period, day: target })),
    ).flat());
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-white">
            <Clock3 size={17} className="text-[#ffc531]" />
            {tr("أوقات العمل الأسبوعية", "Weekly opening hours")}
          </p>
          <p className="mt-1 text-xs leading-5 text-white/50">
            {tr("أضف فترة أو أكثر لكل يوم؛ كل فترة من وإلى. اليوم بلا فترات مغلق تلقائياً.", "Add one or more From–To periods per day. Days without periods are closed automatically.")}
          </p>
        </div>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs text-white/60 hover:text-white"
          >
            {tr("إلغاء الجدول والعودة للتحكم اليدوي", "Remove schedule · manual status only")}
          </button>
        )}
      </div>
      {value.length === 0 && (
        <p className="rounded-xl border border-[#ffc531]/25 bg-[#ffc531]/10 px-3 py-2.5 text-xs leading-5 text-[#ffe6a1]">
          {tr("لم تُحدَّد أوقات عمل بعد. يستمر المتجر وفق الحالة اليدوية الحالية حتى تضيف فترة وتحفظها.", "No hours are set. Your existing manual status stays in effect until you add and save a period.")}
        </p>
      )}
      <div className="space-y-2">
        {Array.from({ length: 7 }, (_, day) => {
          const periods = value.map((period, index) => ({ ...period, index }))
            .filter((period) => period.day === day);
          return (
            <div key={day} className="rounded-xl border border-white/10 bg-[#1b0934]/70 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="min-w-20 text-sm font-bold text-white">{locale === "en" ? WEEKDAYS_EN[day] : WEEKDAYS_AR[day]}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", periods.length ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-white/40")}>
                    {periods.length ? `${periods.length} ${tr("فترة", "period(s)")}` : tr("مغلق", "Closed")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {periods.length > 0 && (
                    <button type="button" onClick={() => copyToWeek(day)} title={tr("نسخ إلى كل الأيام", "Copy to all days")} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-white/50 transition hover:bg-white/10 hover:text-white">
                      <Copy size={13} /> {tr("نسخ للكل", "Copy to all")}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={periods.length >= 8}
                    onClick={() => addPeriod(day)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#ffc531]/40 px-2.5 py-1.5 text-xs font-bold text-[#ffc531] transition hover:bg-[#ffc531]/10 disabled:opacity-40"
                  >
                    <Plus size={14} /> {tr("فترة", "Period")}
                  </button>
                </div>
              </div>
              {periods.length > 0 && (
                <div className="mt-3 space-y-2">
                  {periods.map((period, position) => (
                    <div key={period.index} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-2.5 py-2 text-xs text-white/60">
                      <span className="hidden w-5 text-center tabular-nums sm:inline">{position + 1}</span>
                      <label className="flex items-center gap-1.5">
                        <span>{tr("من", "From")}</span>
                        <input type="time" required value={period.from} onChange={(e) => setPeriod(period.index, "from", e.target.value)} className="w-[112px] rounded-lg border border-white/15 bg-[#281044] px-2 py-1.5 font-bold text-white outline-none focus:border-[#ffc531]" dir="ltr" />
                      </label>
                      <span aria-hidden="true" className="hidden text-[#ffc531] sm:inline">→</span>
                      <label className="flex items-center gap-1.5">
                        <span>{tr("إلى", "To")}</span>
                        <input type="time" required value={period.to} onChange={(e) => setPeriod(period.index, "to", e.target.value)} className="w-[112px] rounded-lg border border-white/15 bg-[#281044] px-2 py-1.5 font-bold text-white outline-none focus:border-[#ffc531]" dir="ltr" />
                      </label>
                      <button type="button" title={tr("حذف الفترة", "Remove period")} aria-label={tr("حذف الفترة", "Remove period")} onClick={() => onChange(value.filter((_, index) => index !== period.index))} className="ms-auto rounded-lg p-1.5 text-rose-300 transition hover:bg-rose-500/15">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs leading-5 text-white/45">
        {tr("التوقيت حسب البحرين. إذا كانت النهاية قبل البداية فتمتد الفترة إلى صباح اليوم التالي؛ تساوي الوقتين يعني ٢٤ ساعة. الفترات المتداخلة لا تُحفظ.", "Times use Bahrain time. If To is earlier than From, the period continues into the next morning; equal times mean 24 hours. Overlapping periods cannot be saved.")}
      </p>
    </div>
  );
}
