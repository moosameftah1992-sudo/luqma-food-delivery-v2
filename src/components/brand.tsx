import { cn } from "@/lib/util";

/** Brand emblem redrawn from the supplied reference: one continuous gold
 * ascending stroke, deep loop, pointed tail and a white map pin. */
export function LogoMark({ size = 44, className }: { size?: number; className?: string; mono?: string; id?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/luqma-mark.svg" alt="لقمة" width={size} height={size} className={cn("shrink-0 object-contain", className)} style={{ width: size, height: size }} />
  );
}

/** CMS logo override may be a full logo; don't append a second wordmark to it. */
export function Logo({
  size = 44,
  tone = "dark",
  withWord = true,
  override,
  className,
  compact,
}: {
  size?: number;
  tone?: "dark" | "light";
  withWord?: boolean;
  override?: string;
  className?: string;
  compact?: boolean;
}) {
  const light = tone === "light";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {override ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={override} alt="لقمة Luqma" style={{ height: size * 1.2, maxWidth: size * 4.3 }} className="max-w-full object-contain" />
      ) : (
        <>
          <LogoMark size={size * 1.13} />
          {withWord && (
            <span className="flex flex-col leading-none">
              <span className={cn("font-display font-extrabold tracking-tight", light ? "text-white" : "text-[#24103E]")} style={{ fontSize: size * 0.69, lineHeight: 0.98 }}>لقمة</span>
              {!compact && <span className={cn("font-ui font-extrabold", light ? "text-white" : "text-[#24103E]")} style={{ fontSize: Math.max(10, size * 0.29), letterSpacing: "0.02em", lineHeight: 1 }}>Luqma</span>}
            </span>
          )}
        </>
      )}
    </span>
  );
}

/** The same corrected mark in a centered stacked lockup for auth and launch moments. */
export function BrandLockup({ override, className }: { override?: string; className?: string }) {
  if (override) return <Logo override={override} size={125} className={className} />;
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <LogoMark size={150} />
      <span className="mt-1 font-display text-6xl font-extrabold leading-none text-white">لقمة</span>
      <span className="font-ui text-4xl font-extrabold leading-none tracking-tight text-white" dir="ltr">Luqma</span>
    </div>
  );
}
