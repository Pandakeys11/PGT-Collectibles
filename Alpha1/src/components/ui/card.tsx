import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  elevated,
}: {
  className?: string;
  children: React.ReactNode;
  /** Accent gradient frame — use sparingly (primary CTA panels). */
  elevated?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-full min-w-0 rounded-2xl backdrop-blur-md sm:rounded-xl",
        elevated
          ? "gradient-border panel-chrome border-transparent shadow-[0_0_0_1px_rgb(var(--holo-a)/0.12),0_28px_90px_-28px_rgb(var(--holo-b)/0.25)]"
          : "panel-chrome border border-border-subtle/70",
        className,
      )}
    >
      {children}
    </div>
  );
}
