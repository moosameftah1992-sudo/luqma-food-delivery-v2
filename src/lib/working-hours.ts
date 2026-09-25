export type WorkingPeriod = {
  /** JavaScript weekday in Bahrain: Sunday = 0, Saturday = 6. */
  day: number;
  from: string;
  to: string;
};

export const WEEKDAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] as const;
export const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DAY_MINUTES = 1440;
const WEEK_MINUTES = 7 * DAY_MINUTES;
const BAHRAIN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minutes(time: string) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}

/** Strictly validate and normalize a full weekly schedule before persisting it. */
export function parseWorkingHours(value: unknown):
  | { ok: true; periods: WorkingPeriod[] }
  | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length > 56) {
    return { ok: false, error: "أوقات العمل يجب أن تكون قائمة لا تتجاوز ٨ فترات يومياً" };
  }

  const periods: WorkingPeriod[] = [];
  const perDay = Array(7).fill(0) as number[];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, error: "بيانات فترة العمل غير صالحة" };
    }
    const row = entry as Record<string, unknown>;
    if (!Number.isInteger(row.day) || Number(row.day) < 0 || Number(row.day) > 6 ||
      typeof row.from !== "string" || typeof row.to !== "string" ||
      !TIME_PATTERN.test(row.from) || !TIME_PATTERN.test(row.to)) {
      return { ok: false, error: "حدّد اليوم ووقت البداية والنهاية بصيغة HH:mm صحيحة" };
    }
    const day = Number(row.day);
    perDay[day]++;
    if (perDay[day] > 8) {
      return { ok: false, error: "الحد الأقصى ٨ فترات لكل يوم" };
    }
    periods.push({ day, from: row.from, to: row.to });
  }

  // Each interval may extend into the next day. Copy the week once to catch
  // a Saturday night interval overlapping one on Sunday morning.
  const intervals = periods.map((period) => {
    const from = period.day * DAY_MINUTES + minutes(period.from);
    const endMinute = minutes(period.to);
    const end = period.day * DAY_MINUTES + endMinute +
      (endMinute <= minutes(period.from) ? DAY_MINUTES : 0);
    return { from, end };
  });
  const candidates = [...intervals, ...intervals.map((period) => ({
    from: period.from + WEEK_MINUTES,
    end: period.end + WEEK_MINUTES,
  }))].sort((a, b) => a.from - b.from || a.end - b.end);

  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].from < candidates[i - 1].end) {
      return { ok: false, error: "فترات العمل تتداخل؛ عدّل أوقات البداية والنهاية" };
    }
  }

  periods.sort((a, b) => a.day - b.day || a.from.localeCompare(b.from));
  return { ok: true, periods };
}

/** Resolve day/time in Bahrain rather than relying on the server's time zone. */
export function bahrainClock(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bahrain",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  const day = BAHRAIN_WEEKDAYS.indexOf(part("weekday"));
  return { day, minute: (Number(part("hour")) % 24) * 60 + Number(part("minute")) };
}

export function isWithinWorkingHours(periods: readonly WorkingPeriod[], at = new Date()) {
  if (!periods.length) return true; // Existing stores keep manual status until a schedule is configured.
  const { day, minute } = bahrainClock(at);
  if (day < 0) return false;
  return periods.some((period) => {
    const start = minutes(period.from);
    const end = minutes(period.to);
    if (period.day === day) {
      return end <= start ? minute >= start : minute >= start && minute < end;
    }
    return period.day === (day + 6) % 7 && end <= start && minute < end;
  });
}

/** Manual busy/closed still wins; a schedule only closes the store outside its periods. */
export function effectiveStoreStatus(status: string, periods: readonly WorkingPeriod[] = [], at = new Date()) {
  if (status === "closed") return "closed";
  if (periods.length && !isWithinWorkingHours(periods, at)) return "closed";
  return status === "busy" ? "busy" : "open";
}

export function todayWorkingHours(periods: readonly WorkingPeriod[], at = new Date()) {
  const { day } = bahrainClock(at);
  return periods.filter((period) => period.day === day);
}
