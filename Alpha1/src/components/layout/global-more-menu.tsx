"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

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
          Links and product info
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
