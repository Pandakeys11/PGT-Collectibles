import { cn } from "@/lib/cn";

export function SpecimenFrame({
  src,
  alt,
  graded = false,
  className,
  busy = false,
  objectFit = "cover",
}: {
  src?: string | null;
  alt: string;
  graded?: boolean;
  className?: string;
  /** Shown while a sharper crop is still rendering */
  busy?: boolean;
  /** Use `contain` so full card + stamps stay visible without extra clipping */
  objectFit?: "cover" | "contain";
}) {
  return (
    <div
      className={cn(
        "relative aspect-[3/4] overflow-hidden rounded-xl border border-border-strong bg-panel-raised",
        graded && "ring-1 ring-accent/30",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={cn("h-full w-full", objectFit === "contain" ? "object-contain" : "object-cover")}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-faint">No crop</div>
      )}
      {busy ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25"
          aria-hidden
        >
          <span className="rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white/90">
            Sharpening…
          </span>
        </div>
      ) : null}
    </div>
  );
}
