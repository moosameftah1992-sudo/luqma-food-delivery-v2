"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/util";

let ctx: AudioContext | null = null;

/** Synthesised two-tone brass chime — no external audio asset required. */
export function chime(kind: "order" | "info" = "order") {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    const notes = kind === "order" ? [880, 1318.5] : [660, 880];
    notes.forEach((f, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, now + i * 0.16);
      gain.gain.setValueAtTime(0.0001, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.28, now + i * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.45);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.5);
    });
  } catch {
    /* audio unavailable */
  }
}

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctx = new AC();
    }
    void ctx.resume();
  } catch {
    /* ignore */
  }
}

export function SoundSwitch({ className }: { className?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem("luqma_sound");
    if (stored === "on") {
      unlockAudio();
      setOn(true);
    }
    const h = () => unlockAudio();
    window.addEventListener("pointerdown", h, { once: true });
    return () => window.removeEventListener("pointerdown", h);
  }, []);
  const toggle = () => {
    const next = !on;
    setOn(next);
    window.localStorage.setItem("luqma_sound", next ? "on" : "off");
    if (next) {
      unlockAudio();
      chime("info");
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-bold transition",
        on
          ? "border-[#FDBA21] bg-[#FDBA21] text-[#2A0A4A]"
          : "border-white/25 bg-white/5 text-white/70 hover:border-[#FDBA21]/60",
        className,
      )}
      aria-pressed={on}
    >
      {on ? "🔔 التنبيهات الصوتية مفعّلة" : "🔕 تفعيل التنبيهات الصوتية"}
    </button>
  );
}

/** Polls an endpoint and fires an alert when a new key appears. */
export function useLiveList<T extends { id: number }>(
  url: string,
  intervalMs = 5000,
  opts: { silent?: boolean } = {},
) {
  const [items, setItems] = useState<T[]>([]);
  const [flash, setFlash] = useState<T | null>(null);
  const seen = useRef<Set<number> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as T[];
      setItems(data);
      if (seen.current === null) {
        seen.current = new Set(data.map((d) => d.id));
      } else {
        const fresh = data.find((d) => !seen.current!.has(d.id));
        if (fresh && !opts.silent) {
          seen.current = new Set(data.map((d) => d.id));
          setFlash(fresh);
          const stored = window.localStorage.getItem("luqma_sound");
          if (stored !== "off") chime("order");
          window.setTimeout(() => setFlash(null), 6000);
        } else {
          seen.current = new Set(data.map((d) => d.id));
        }
      }
      setLoading(false);
    } catch {
      /* network hiccup — keep last known state */
    }
  }, [url, opts.silent]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), intervalMs);
    return () => window.clearInterval(id);
  }, [load, intervalMs]);

  return { items, setItems, refresh: load, flash, loading };
}

export function AlertFlash({
  title,
  subtitle,
  onDismiss,
}: {
  title: string;
  subtitle: string;
  onDismiss?: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(() => onDismiss?.(), 6000);
    return () => window.clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] flex items-start justify-center p-4 sm:p-8">
      <div className="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-[#FDBA21] bg-[#2A0A4A] shadow-[0_0_0_6px_rgba(253,186,33,0.18),0_30px_80px_rgba(27,7,51,0.6)] alert-pop">
        <div className="h-2 w-full bg-gradient-to-l from-[#FF6A00] to-[#FFD75E]" />
        <div className="flex items-center gap-4 p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#FDBA21] text-2xl">
            🔔
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-extrabold text-white">{title}</p>
            <p className="truncate text-sm text-white/70">{subtitle}</p>
          </div>
          <button
            onClick={onDismiss}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/70 transition hover:border-[#FDBA21] hover:text-[#FDBA21]"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toast({
  msg,
  tone = "ok",
  onClose,
}: {
  msg: string;
  tone?: "ok" | "err";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className={cn(
        "fixed bottom-24 left-1/2 z-[95] -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-bold shadow-xl toast-in",
        tone === "ok" ? "bg-[#2A0A4A] text-[#FDBA21]" : "bg-rose-600 text-white",
      )}
      role="status"
    >
      {msg}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "err" } | null>(null);
  const show = useCallback((msg: string, tone: "ok" | "err" = "ok") => setToast({ msg, tone }), []);
  const node = toast ? (
    <Toast msg={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />
  ) : null;
  return { show, node };
}
