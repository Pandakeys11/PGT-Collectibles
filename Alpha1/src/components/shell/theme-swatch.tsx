import { EnergySymbol } from "@/components/shell/energy-symbol";
import { THEME_SWATCHES } from "@/lib/theme-swatches";
import { THEME_ENERGY_MAP } from "@/lib/energy-theme";
import type { ThemeId } from "@/lib/themes";
import { cn } from "@/lib/cn";

export function ThemeSwatchStrip({
  themeId,
  className,
  size = "md",
}: {
  themeId: ThemeId;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const colors = THEME_SWATCHES[themeId];
  const h = size === "sm" ? "h-2" : size === "lg" ? "h-3.5" : "h-2.5";

  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-full shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)] ring-2 ring-inset ring-white/20",
        h,
        className,
      )}
      aria-hidden
    >
      {colors.map((color, i) => (
        <span
          key={i}
          className="min-w-0 flex-1 border-r border-black/20 last:border-r-0"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

/** Energy badge + theme palette ring for pickers and header toggle. */
export function ThemeSwatchOrb({
  themeId,
  className,
  showPaletteRing = true,
}: {
  themeId: ThemeId;
  className?: string;
  showPaletteRing?: boolean;
}) {
  const colors = THEME_SWATCHES[themeId];
  const { primary, secondary } = THEME_ENERGY_MAP[themeId];
  const dual = primary !== secondary;
  const paletteRing = `conic-gradient(from 210deg, ${colors[0]} 0deg, ${colors[1]} 72deg, ${colors[2]} 144deg, ${colors[3]} 216deg, ${colors[4]} 288deg, ${colors[0]} 360deg)`;

  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", className)} aria-hidden>
      {showPaletteRing ? (
        <span
          className="absolute -inset-[3px] rounded-[11px]"
          style={{
            background: paletteRing,
            boxShadow: `0 0 14px -3px ${colors[0]}88`,
          }}
        />
      ) : null}

      <span
        className={cn(
          "relative flex items-center justify-center rounded-[9px] bg-[#06080c] p-[3px]",
          showPaletteRing ? "ring-1 ring-white/30" : "ring-1 ring-white/15",
        )}
        style={{
          boxShadow: `0 0 12px -2px rgb(var(--energy-${primary}-glow) / 0.7), inset 0 1px 0 rgb(255 255 255 / 0.12)`,
        }}
      >
        <EnergySymbol energy={primary} size="md" />
      </span>

      {dual ? (
        <span
          className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-[6px] bg-[#06080c] p-[2px] ring-2 ring-white/25"
          style={{
            boxShadow: `0 0 10px -2px rgb(var(--energy-${secondary}-glow) / 0.65)`,
          }}
        >
          <EnergySymbol energy={secondary} size="xs" />
        </span>
      ) : null}
    </span>
  );
}
