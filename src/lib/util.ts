export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** 12500 -> "12.500 د.ب" */
export function fmtFils(fils: unknown, withUnit = true) {
  const n = typeof fils === "string" ? Number(fils) : typeof fils === "number" ? fils : 0;
  const v = (Number.isFinite(n) ? n : 0) / 1000;
  const s = v.toFixed(3);
  return withUnit ? `${s} د.ب` : s;
}

export function num(v: unknown, fallback = 0) {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function toDate(d: unknown): Date | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function fmtDate(d: unknown) {
  const date = toDate(d);
  if (!date) return "—";
  return `${date.getDate()} ${AR_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function fmtTime(d: unknown) {
  const date = toDate(d);
  if (!date) return "—";
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  const suffix = h >= 12 ? "م" : "ص";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m} ${suffix}`;
}

export function fmtDateTime(d: unknown) {
  return `${fmtDate(d)} · ${fmtTime(d)}`;
}

export function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export const ORDER_STATUS_AR: Record<string, string> = {
  pending: "بانتظار قبول المتجر",
  accepted: "تم القبول — بانتظار مندوب",
  ready: "جاهز للاستلام",
  assigned: "تم تعيين مندوب",
  onway: "في الطريق إليك",
  delivered: "تم التوصيل",
  rejected: "مرفوض من المتجر",
  cancelled_customer: "ملغي من العميل",
  cancelled_store: "ملغي من المتجر",
  cancelled_driver: "ملغي من المندوب",
};

export const ORDER_STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/40",
  accepted: "bg-[#FF7A00]/15 text-[#B4520A] border-[#FF7A00]/40",
  ready: "bg-[#FDBA21]/25 text-[#8A5A00] border-[#FDBA21]/60",
  assigned: "bg-[#2A0A4A]/10 text-[#2A0A4A] border-[#2A0A4A]/30",
  onway: "bg-[#2A0A4A]/15 text-[#2A0A4A] border-[#2A0A4A]/40",
  delivered: "bg-[#2FA36B]/12 text-[#1E6E48] border-[#2FA36B]/40",
  rejected: "bg-rose-500/10 text-rose-700 border-rose-500/35",
  cancelled_customer: "bg-rose-500/10 text-rose-700 border-rose-500/35",
  cancelled_store: "bg-rose-500/10 text-rose-700 border-rose-500/35",
  cancelled_driver: "bg-rose-500/10 text-rose-700 border-rose-500/35",
};

export function csvEscape(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], headers: string[]) {
  const keys = Object.keys(rows[0] ?? {});
  const head = (headers.length ? headers : keys).map(csvEscape).join(",");
  const body = rows
    .map((r) => keys.map((k) => csvEscape(r[k])).join(","))
    .join("\n");
  return "\uFEFF" + head + "\n" + body;
}

export function downloadFile(name: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
