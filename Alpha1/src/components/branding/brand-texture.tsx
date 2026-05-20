import { BRAND } from "@/lib/branding";
import { cn } from "@/lib/cn";

/** Low-opacity brand texture — pairs with desk / vision backdrops. */
export function BrandTexture({
  className,
  intensity = "subtle",
}: {
  className?: string;
  intensity?: "subtle" | "medium";
}) {
  const opacity = intensity === "medium" ? "opacity-[0.12]" : "opacity-[0.07]";
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 bg-repeat mix-blend-overlay grayscale",
        opacity,
        className,
      )}
      style={{
        backgroundImage: `url(${BRAND.textureOoze})`,
        backgroundSize: "480px",
      }}
      aria-hidden
    />
  );
}
