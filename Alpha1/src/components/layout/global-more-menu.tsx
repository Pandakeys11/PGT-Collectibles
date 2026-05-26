"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, ExternalLink, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { ThemeSwatchOrb, ThemeSwatchStrip } from "@/components/shell/theme-swatch";
import { Button } from "@/components/ui/button";
import { applyTheme, readActiveTheme, THEME_CHANGE_EVENT } from "@/lib/apply-theme";
import { themeEnergyLabel } from "@/lib/energy-theme";
import { DEFAULT_THEME_ID, THEME_GROUP_LABELS, THEMES, type ThemeGroup, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/cn";

const THEME_GROUPS: ThemeGroup[] = ["core", "tcg"];

function ThemePickerGrid({ onPick }: { onPick: () => void }) {
  const [activeId, setActiveId] = useState<ThemeId>(DEFAULT_THEME_ID);

  useLayoutEffect(() => {
    setActiveId(readActiveTheme());
    const sync = () => setActiveId(readActiveTheme());
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, sync);
  }, []);

  return (
    <div className="mt-3 max-h-[min(22rem,55dvh)] space-y-4 overflow-y-auto pr-0.5">
      {THEME_GROUPS.map((group) => (
        <div key={group}>
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="h-3 w-3 text-accent-tertiary" aria-hidden />
            <p className="text-desk-label">{THEME_GROUP_LABELS[group]}</p>
          </div>
          <div className="mt-2 grid gap-2">
            {THEMES.filter((t) => t.group === group).map((theme) => {
              const active = theme.id === activeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    applyTheme(theme.id);
                    setActiveId(theme.id);
                    onPick();
                  }}
                  className={cn(
                    "group w-full overflow-hidden rounded-2xl border text-left transition touch-manipulation",
                    active
                      ? "border-border-accent bg-panel-raised/90 shadow-[0_0_32px_-8px_rgb(var(--holo-a)/0.35)]"
                      : "border-border-subtle bg-panel-raised/50 hover:border-border-accent/60 hover:bg-panel-raised/80",
                  )}
                >
                  <ThemeSwatchStrip themeId={theme.id} size="md" className="rounded-none" />
                  <div className="flex items-start gap-3 px-3 py-2.5">
                    <ThemeSwatchOrb themeId={theme.id} className="h-11 w-11 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-primary">{theme.label}</span>
                        {active ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-medium leading-snug text-accent/90">
                        {themeEnergyLabel(theme.id)}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-muted">{theme.hint}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GlobalMoreMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-canvas/65 backdrop-blur-md" />
        <Dialog.Content
          className={cn(
            "desk-surface-raised fixed z-[81] outline-none",
            "inset-x-0 bottom-0 max-h-[min(90dvh,36rem)] rounded-t-[1.35rem] border border-border-subtle/80 p-6",
            "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
            "lg:inset-x-auto lg:bottom-auto lg:right-8 lg:top-[calc(4.75rem+env(safe-area-inset-top))] lg:w-[min(100vw-2rem,24rem)] lg:rounded-2xl lg:p-5",
          )}
        >
          <MoreMenuHeader />
          <div className="mt-5 space-y-5">
            <section className="rounded-2xl bg-panel-raised/40 p-4">
              <p className="text-desk-label">Appearance</p>
              <p className="mt-1.5 text-caption">
                Palettes, panel tints, and ambient atmosphere.
              </p>
              <ThemePickerGrid onPick={() => onOpenChange(false)} />
            </section>
            <section className="desk-divider border-t pt-5">
              <p className="text-desk-label">Account</p>
              <ul className="mt-2 space-y-1">
                <li>
                  <Link
                    href="/profile"
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-sm text-primary transition hover:bg-panel-raised touch-manipulation"
                    onClick={() => onOpenChange(false)}
                  >
                    Profile
                  </Link>
                </li>
                <li>
                  <Link
                    href="/saved"
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-sm text-primary transition hover:bg-panel-raised touch-manipulation"
                    onClick={() => onOpenChange(false)}
                  >
                    Saved cards
                  </Link>
                </li>
                <li>
                  <Link
                    href="/usage"
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-sm text-primary transition hover:bg-panel-raised touch-manipulation"
                    onClick={() => onOpenChange(false)}
                  >
                    Usage
                  </Link>
                </li>
                <li>
                  <a
                    href="https://pokemontcg.io/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-2 rounded-xl px-3 py-3 text-sm text-primary transition hover:bg-panel-raised touch-manipulation"
                  >
                    Pokémon TCG API
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                  </a>
                </li>
              </ul>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MoreMenuHeader() {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <Dialog.Title className="font-display text-lg font-semibold text-primary">More</Dialog.Title>
        <Dialog.Description className="mt-1 text-desk-subtitle">
          Theme, links, and product info
        </Dialog.Description>
      </div>
      <Dialog.Close asChild>
        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 shrink-0 px-0" aria-label="Close menu">
          <X className="h-4 w-4" />
        </Button>
      </Dialog.Close>
    </div>
  );
}
