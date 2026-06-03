"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookmarkPlus, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlabzPackGifShowcase } from "@/components/scanner-chat/slabz-pack-gif-showcase";
import { SlabzPackVisual } from "@/components/scanner-chat/slabz-pack-visual";
import { SlabzRipOpenAnimation } from "@/components/scanner-chat/slabz-rip-animation";
import {
  SlabzPanelFooter,
  SlabzPanelHeader,
  SlabzStatsStrip,
  SlabzTabBar,
  SlabzWalletCard,
} from "@/components/scanner-chat/slabz/slabz-panel-chrome";
import { useSlabzPartner } from "@/components/scanner-chat/slabz-partner-provider";
import { SlabzRipDemoBanner } from "@/components/scanner-chat/slabz-rip-demo-banner";
import { formatSlabzUsd, slabzRarityClass, slabzRarityLabel } from "@/lib/slabz/display";
import { normalizeSlabzPack } from "@/lib/slabz/pack-art";
import type { SlabzPack, SlabzRipRecord } from "@/lib/slabz/types";
import { cn } from "@/lib/cn";

function PackTile({
  pack,
  disabled,
  ripping,
  onRip,
  featured,
}: {
  pack: SlabzPack;
  disabled: boolean;
  ripping: boolean;
  onRip: () => void;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "sc-slabz-pack-tile group relative flex flex-col overflow-hidden rounded-2xl border border-cyan-400/20 p-3 ring-1 ring-white/8 transition",
        "hover:border-cyan-300/35 hover:ring-cyan-400/15",
        featured &&
          "sm:flex-row sm:items-center sm:gap-6 sm:p-5 lg:mx-auto lg:max-w-2xl",
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl transition group-hover:bg-cyan-300/15" />
      <div className="pointer-events-none absolute -left-6 bottom-0 h-20 w-20 rounded-full bg-fuchsia-500/10 blur-2xl" />
      <SlabzPackVisual
        pack={pack}
        size={featured ? "showcase" : "card"}
        variant={featured ? "rip" : "tile"}
        className="relative z-[1]"
      />
      <div className={cn("relative z-[1] mt-3 flex flex-1 flex-col", featured && "sm:mt-0")}>
        <p
          className={cn(
            "line-clamp-2 text-center font-semibold leading-snug text-slate-50",
            featured ? "text-left text-sm" : "text-[11px]",
          )}
        >
          {pack.name}
        </p>
        {pack.description ? (
          <p
            className={cn(
              "mt-1 line-clamp-2 text-slate-500",
              featured ? "text-left text-[10px]" : "text-center text-[9px]",
            )}
          >
            {pack.description}
          </p>
        ) : null}
        <p
          className={cn(
            "mt-2 font-mono font-bold tabular-nums text-cyan-200",
            featured ? "text-left text-xl" : "text-center text-sm",
          )}
        >
          {formatSlabzUsd(pack.priceCents)}
        </p>
        <Button
          type="button"
          size="sm"
          disabled={disabled || ripping}
          onClick={onRip}
          className={cn(
            "sc-slabz-rip-cta mt-3 w-full border-cyan-300/35 bg-gradient-to-r from-cyan-600/30 via-sky-600/25 to-fuchsia-600/25 text-[11px] font-bold text-white shadow-[0_0_20px_rgba(34,211,238,0.15)]",
            "hover:from-cyan-500/40 hover:to-fuchsia-500/35",
            featured && "sm:max-w-[12rem]",
          )}
        >
          {ripping ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Ripping…
            </>
          ) : (
            <>
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              Rip pack
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function RipRevealCard({
  card,
  packName,
  onSaveToCollection,
  onOpenInScan,
  saving,
  openingScan,
}: {
  card: NonNullable<SlabzRipRecord["card"]>;
  packName: string;
  onSaveToCollection?: () => void;
  onOpenInScan?: () => void;
  saving?: boolean;
  openingScan?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, rotateY: -18 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="sc-slabz-reveal-card mx-auto w-full max-w-sm"
    >
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="relative mx-auto block w-[11rem] perspective-[900px] sm:w-[13rem] md:w-[14rem]"
        aria-label="Flip card — tap to see back"
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.55 }}
          className="relative h-[15rem] w-full preserve-3d sm:h-[17rem] md:h-[18rem]"
          style={{ transformStyle: "preserve-3d" }}
        >
          <div
            className="absolute inset-0 overflow-hidden rounded-xl border border-cyan-400/35 bg-gradient-to-b from-slate-900 to-black shadow-[0_0_40px_rgba(34,211,238,0.28)] backface-hidden"
            style={{ backfaceVisibility: "hidden" }}
          >
            {card.imageUrl && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.imageUrl}
                alt={card.name}
                className="h-full w-full object-contain p-2"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">No image</div>
            )}
          </div>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-cyan-500/25 bg-slate-950/90 p-3 backface-hidden"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <p className="text-[10px] uppercase tracking-wider text-violet-300/80">Back</p>
            {card.imageBackUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.imageBackUrl} alt="" className="mt-2 max-h-[10rem] object-contain" />
            ) : (
              <p className="mt-4 text-[11px] text-slate-400">No back image</p>
            )}
          </div>
        </motion.div>
      </button>
      <div className="mt-4 space-y-2 text-center sm:mt-5">
        <p className="text-base font-semibold text-slate-50 sm:text-lg">{card.name}</p>
        <p className="text-[10px] text-slate-500 sm:text-[11px]">{packName}</p>
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1",
            slabzRarityClass(card.rarity),
          )}
        >
          {slabzRarityLabel(card.rarity)}
        </span>
        <p className="font-mono text-xl font-bold text-emerald-300 sm:text-2xl">
          FMV {formatSlabzUsd(card.insuredValueCents)}
        </p>
        <p className="text-[9px] text-slate-600">Tap card to flip</p>
        {card.grade ? (
          <p className="text-[10px] text-slate-400">
            {card.gradingCompany ?? "Graded"} · {card.grade}
          </p>
        ) : null}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {onOpenInScan ? (
            <Button
              type="button"
              size="sm"
              disabled={openingScan}
              className="flex-1 text-[10px]"
              onClick={() => void onOpenInScan()}
            >
              {openingScan ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Opening…
                </>
              ) : (
                "Open in Liquid Scan"
              )}
            </Button>
          ) : null}
          {onSaveToCollection ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving}
              className="flex-1 text-[10px]"
              onClick={() => void onSaveToCollection()}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
                  Save to collection
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

const RIP_STATUS_CLASS: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
  confirmed: "bg-sky-500/15 text-sky-200 ring-sky-400/30",
  opening: "bg-amber-500/15 text-amber-200 ring-amber-400/30",
  failed: "bg-rose-500/15 text-rose-200 ring-rose-400/30",
  created: "bg-slate-500/15 text-slate-300 ring-white/15",
};

function RipHistoryRow({
  rip,
  pack,
  onReveal,
  revealing,
  onSaveToCollection,
  savingToCollection,
}: {
  rip: SlabzRipRecord;
  pack: SlabzPack | null;
  onReveal?: () => void;
  revealing?: boolean;
  onSaveToCollection?: () => void;
  savingToCollection?: boolean;
}) {
  const card = rip.card;
  const packStub: SlabzPack =
    pack ??
    normalizeSlabzPack({
      id: rip.packId,
      name: rip.packName ?? "Pack rip",
      priceCents: rip.priceCents ?? 0,
    });
  const needsReveal =
    !card && (rip.status === "confirmed" || rip.status === "opening" || rip.status === "created");
  const statusClass = RIP_STATUS_CLASS[rip.status] ?? RIP_STATUS_CLASS.created;

  return (
    <div className="sc-slabz-history-row flex gap-3 rounded-2xl border border-white/8 p-3 ring-1 ring-white/5 sm:gap-4 sm:p-3.5">
      {card?.imageUrl ? (
        <div className="h-[4.5rem] w-[3.5rem] shrink-0 overflow-hidden rounded-xl bg-black/50 ring-1 ring-cyan-400/20 sm:h-20 sm:w-[4.5rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.imageUrl} alt="" className="h-full w-full object-contain p-0.5" />
        </div>
      ) : (
        <SlabzPackVisual pack={packStub} size="thumb" className="!mx-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-[11px] font-semibold text-slate-100">
            {card?.name ?? rip.packName ?? "Pack rip"}
          </p>
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ring-1",
              statusClass,
            )}
          >
            {rip.status}
          </span>
        </div>
        <p className="mt-0.5 text-[9px] text-slate-500">
          Paid {formatSlabzUsd(rip.priceCents)} · {new Date(rip.createdAt).toLocaleString()}
        </p>
        {card?.grade ? (
          <p className="mt-0.5 text-[9px] text-slate-400">
            {card.gradingCompany ?? "Graded"} {card.grade}
            {card.rarity ? ` · ${slabzRarityLabel(card.rarity)}` : ""}
          </p>
        ) : null}
        {needsReveal && onReveal ? (
          <Button
            type="button"
            size="sm"
            disabled={revealing}
            className="mt-2 h-7 text-[10px]"
            onClick={() => void onReveal()}
          >
            {revealing ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Revealing…
              </>
            ) : (
              "Reveal slab"
            )}
          </Button>
        ) : null}
        {card && onSaveToCollection ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={savingToCollection}
            className="mt-1.5 h-7 text-[10px] text-cyan-200/90"
            onClick={() => void onSaveToCollection()}
          >
            {savingToCollection ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <BookmarkPlus className="mr-1 h-3 w-3" />
            )}
            Save to collection
          </Button>
        ) : null}
      </div>
      {card ? (
        <div className="shrink-0 text-right">
          <p className="text-[8px] uppercase tracking-wide text-slate-500">FMV</p>
          <p className="font-mono text-[11px] font-bold text-emerald-300">
            {formatSlabzUsd(card.insuredValueCents)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function SlabzRipPanel({
  onDismiss,
  onOpenRipInScan,
  className,
}: {
  onDismiss?: () => void;
  onOpenRipInScan?: (rip: SlabzRipRecord, pack: SlabzPack | null) => void;
  className?: string;
}) {
  const slabz = useSlabzPartner();
  const [tab, setTab] = useState<"packs" | "history">("packs");
  const docsUrl = slabz.status?.capabilities.docsUrl ?? "https://api-docs.slabz.com/";
  const ripping = Boolean(slabz.activeRip && slabz.activeRip.phase !== "idle");
  const catalogCards = slabz.status?.catalogStats?.catalogCards;
  const livePacks = slabz.status?.livePackCount;

  const ripCount = slabz.recentRips.length;
  const completedWithSlab = slabz.recentRips.filter((r) => r.status === "completed" && r.card);
  const [openingScan, setOpeningScan] = useState(false);

  return (
    <div className={cn("sc-slabz-rip-panel flex min-h-0 min-w-0 flex-col", className)}>
      <SlabzPanelHeader
        network={slabz.network}
        onRefreshPacks={() => void slabz.reloadPacks()}
        packsLoading={slabz.packsLoading}
        onDismiss={onDismiss}
      />

      <div className="sc-slabz-rip-panel__scroll min-h-0 flex-1 overflow-y-auto scanner-chat-scrollbar">
        <div className="sc-slabz-rip-panel__inner p-3 sm:p-4 md:p-5">
          <SlabzRipDemoBanner className="mb-3" />

          {!slabz.configured ? (
            <div className="sc-slabz-alert sc-slabz-alert--warn">
              <p className="font-semibold text-amber-200">Slabz partner API not configured</p>
              <p className="mt-1 text-amber-100/80">
                Set <code className="text-amber-200/90">SLABZ_API_KEY=slbz_…</code> in{" "}
                <code className="text-amber-200/90">.env.local</code>, then restart dev. See{" "}
                <a href={docsUrl} target="_blank" rel="noreferrer" className="underline text-amber-200">
                  API docs
                </a>
                .
              </p>
            </div>
          ) : (
            <SlabzStatsStrip
              configured={slabz.configured}
              livePacks={livePacks}
              catalogCards={catalogCards}
              ripCount={ripCount}
              signedIn={slabz.signedIn}
              catalogSyncing={slabz.catalogSyncing}
              onSyncCatalog={() => void slabz.syncMasterCatalog()}
            />
          )}

          <SlabzWalletCard
            signedIn={slabz.signedIn}
            walletAddress={slabz.walletAddress}
            walletLinkedToAccount={slabz.walletLinkedToAccount}
            walletBalance={slabz.walletBalance}
            walletBalanceLoading={slabz.walletBalanceLoading}
            walletConnecting={slabz.walletConnecting}
            walletError={slabz.walletError}
            phantomInstalled={slabz.phantomInstalled}
            onConnect={() => void slabz.connectWallet().catch(() => {})}
            onDisconnect={() => void slabz.disconnectWallet()}
            onRefreshBalance={() => void slabz.reloadWalletBalance()}
          />

          <div className="sc-slabz-body lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-5">
            <AnimatePresence mode="wait">
              {slabz.activeRip ? (
                <motion.section
                  key="active-rip"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="sc-slabz-stage mb-4 lg:sticky lg:top-0 lg:mb-0"
                >
                  <div className="sc-slabz-stage__inner p-3 sm:p-4 md:p-5">
              {slabz.activeRip.phase === "reveal" && slabz.activeRip.revealedCard ? (
                <>
                  <RipRevealCard
                    card={slabz.activeRip.revealedCard}
                    packName={slabz.activeRip.pack.name}
                    saving={slabz.collectionSaving}
                    openingScan={openingScan}
                    onOpenInScan={
                      onOpenRipInScan && slabz.activeRip?.revealedCard
                        ? () => {
                            const ar = slabz.activeRip!;
                            const ripRecord: SlabzRipRecord =
                              slabz.recentRips.find(
                                (r) => r.slabzTransactionId === ar.transactionId,
                              ) ?? {
                                id: ar.transactionId,
                                slabzTransactionId: ar.transactionId,
                                packId: ar.pack.id,
                                packName: ar.pack.name,
                                status: "completed",
                                walletAddress: slabz.walletAddress ?? "",
                                priceCents: ar.priceCents,
                                card: ar.revealedCard,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                              };
                            setOpeningScan(true);
                            void Promise.resolve(
                              onOpenRipInScan(ripRecord, ar.pack),
                            ).finally(() => setOpeningScan(false));
                          }
                        : undefined
                    }
                    onSaveToCollection={
                      slabz.signedIn
                        ? () =>
                            void slabz.saveRipsToCollection({
                              transactionIds: [slabz.activeRip!.transactionId],
                            })
                        : undefined
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3 w-full text-[11px]"
                    onClick={() => slabz.resetRip()}
                  >
                    Rip another pack
                  </Button>
                </>
              ) : slabz.activeRip.phase === "error" ? (
                <>
                  <p className="text-[11px] text-rose-300">{slabz.activeRip.error}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="mt-2 w-full text-[11px]"
                    onClick={() => slabz.resetRip()}
                  >
                    Dismiss
                  </Button>
                </>
              ) : slabz.activeRip.phase === "open" ||
                slabz.activeRip.phase === "purchase" ||
                slabz.activeRip.phase === "sign" ||
                slabz.activeRip.phase === "submit" ? (
                <SlabzRipOpenAnimation
                  pack={slabz.activeRip.pack}
                  message={slabz.activeRip.statusMessage}
                />
              ) : (
                <div className="flex items-center gap-3">
                  <SlabzPackVisual
                    pack={slabz.activeRip.pack}
                    size="showcase"
                    variant="rip"
                    className="!mx-0 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <Loader2 className="mb-1.5 h-4 w-4 animate-spin text-cyan-300" />
                    <p className="text-[11px] font-medium text-cyan-50">{slabz.activeRip.pack.name}</p>
                    <p className="text-[10px] text-slate-400">{slabz.activeRip.statusMessage}</p>
                  </div>
                </div>
              )}
                  </div>
                </motion.section>
              ) : null}
            </AnimatePresence>

            <div className="sc-slabz-main min-w-0">
              <SlabzTabBar tab={tab} onTabChange={setTab} ripCount={ripCount} />

              {slabz.collectionSaveMessage ? (
                <p className="mb-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[10px] text-emerald-100/90">
                  {slabz.collectionSaveMessage}
                  <button
                    type="button"
                    className="ml-2 underline text-emerald-200/80"
                    onClick={() => slabz.clearCollectionSaveMessage()}
                  >
                    Dismiss
                  </button>
                </p>
              ) : null}

              {tab === "packs" ? (
          <>
            {slabz.packsLoading ? (
              <p className="flex items-center justify-center gap-2 py-8 text-[11px] text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading packs…
              </p>
            ) : slabz.packsError ? (
              <p className="rounded-lg border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-[11px] text-rose-200/90">
                {slabz.packsError}
              </p>
            ) : slabz.packs.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-slate-500">No packs available right now.</p>
            ) : (
              <>
              <SlabzPackGifShowcase packs={slabz.packs} className="mb-4" />
              <div
                className={cn(
                  "sc-slabz-pack-grid grid gap-3 sm:gap-4",
                  slabz.packs.length === 1
                    ? "grid-cols-1"
                    : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-2",
                )}
              >
                {slabz.packs.map((pack: SlabzPack) => (
                  <PackTile
                    key={pack.id}
                    pack={pack}
                    featured={slabz.packs.length === 1}
                    disabled={!slabz.signedIn || !slabz.configured || ripping}
                    ripping={ripping && slabz.activeRip?.pack.id === pack.id}
                    onRip={() => void slabz.startRip(pack)}
                  />
                ))}
              </div>
              </>
            )}
            <p className="sc-slabz-footnote mt-4 text-center text-[10px] leading-relaxed text-slate-500">
              Devnet uses USDC-DEV — fund Phantom on Devnet before ripping.{" "}
              <a
                href="https://spl-token-faucet.com/?token-name=USDC-Dev"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-cyan-400 underline"
              >
                Get USDC-DEV
              </a>
            </p>
          </>
              ) : (
          <div className="sc-slabz-history-list space-y-2.5 sm:space-y-3">
            {completedWithSlab.length > 0 && slabz.signedIn ? (
              <Button
                type="button"
                size="sm"
                disabled={slabz.collectionSaving}
                className="mb-1 w-full border-cyan-400/25 text-[10px]"
                onClick={() =>
                  void slabz.saveRipsToCollection({
                    transactionIds: completedWithSlab.map((r) => r.slabzTransactionId),
                  })
                }
              >
                {slabz.collectionSaving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Syncing slabs…
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
                    Sync {completedWithSlab.length} ripped slab
                    {completedWithSlab.length === 1 ? "" : "s"} to collection
                  </>
                )}
              </Button>
            ) : null}
            {slabz.recentRips.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-slate-500">
                No rips yet — your history syncs to your Clerk account.
              </p>
            ) : (
              slabz.recentRips.map((rip) => (
                <RipHistoryRow
                  key={rip.id}
                  rip={rip}
                  pack={slabz.packs.find((p) => p.id === rip.packId) ?? null}
                  revealing={
                    slabz.activeRip?.transactionId === rip.slabzTransactionId &&
                    slabz.activeRip.phase === "open"
                  }
                  onReveal={
                    !rip.card &&
                    (rip.status === "confirmed" || rip.status === "created")
                      ? () => void slabz.revealStuckRip(rip)
                      : undefined
                  }
                  onSaveToCollection={
                    rip.card && slabz.signedIn
                      ? () =>
                          void slabz.saveRipsToCollection({
                            transactionIds: [rip.slabzTransactionId],
                          })
                      : undefined
                  }
                  savingToCollection={slabz.collectionSaving}
                />
              ))
            )}
          </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <SlabzPanelFooter docsUrl={docsUrl} />
    </div>
  );
}
