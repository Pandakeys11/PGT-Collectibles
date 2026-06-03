"use client";

import { motion } from "framer-motion";
import { User } from "lucide-react";
import { ExpandableImageThumb, ImageLightbox } from "@/components/ui/image-lightbox";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { CompanionController } from "@/hooks/use-companion";
import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
import type { SlabzPack, SlabzRipRecord } from "@/lib/slabz/types";
import type { CatalogCandidate } from "@/lib/scan/schemas";
import type { ChatMessage, ScanSummary, SystemChatMessage } from "@/lib/scanner-chat/types";
import { scanModeLabel } from "@/lib/scanner-chat/scan-mode-labels";
import { AIStreamingScanMessage } from "./ai-streaming-scan-message";
import { ScanProgressTimeline } from "./scan-progress-timeline";
import { useUploadImageLightbox } from "./use-upload-image-lightbox";
import { cn } from "@/lib/cn";

function UserMessage({ message }: { message: Extract<ChatMessage, { role: "user" }> }) {
  const uploadImages =
    message.images?.map((img, i) => ({
      id: img.id,
      previewUrl: img.previewUrl,
      label: `Scan upload ${i + 1}`,
    })) ?? [];
  const lightbox = useUploadImageLightbox(uploadImages);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-end gap-3"
    >
      <div className="max-w-[min(100%,42rem)] space-y-2">
        {message.text ? (
          <div className="rounded-xl rounded-tr-md bg-sky-500/15 px-2.5 py-2 text-xs leading-snug text-slate-100 ring-1 ring-sky-400/20 max-lg:max-w-[min(100%,20rem)] sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
            {message.text}
          </div>
        ) : null}
        {message.images?.length ? (
          <div className="flex flex-wrap justify-end gap-2">
            {message.images.map((img, i) => (
              <ExpandableImageThumb
                key={img.id}
                src={img.previewUrl}
                alt={`Scan ${i + 1}`}
                gallery={lightbox.gallery}
                galleryIndex={i}
                onOpenGallery={lightbox.openAt}
                className="h-14 w-14 sm:h-16 sm:w-16"
              />
            ))}
          </div>
        ) : null}
        {message.images?.length ? (
          <ImageLightbox
            open={lightbox.open}
            onClose={lightbox.close}
            src={null}
            alt=""
            gallery={lightbox.gallery}
            galleryIndex={lightbox.index}
            onGalleryIndexChange={lightbox.setIndex}
          />
        ) : null}
        <p className="text-right text-[10px] text-slate-600">
          {message.scanMode ? scanModeLabel(message.scanMode) : "Scan"}
          {message.images?.length ? ` · ${message.images.length} image(s)` : ""}
        </p>
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/8">
        <User className="h-4 w-4 text-slate-400" />
      </div>
    </motion.article>
  );
}

export type CardInteractionHandlers = {
  selectedSpecimenId?: string | null;
  onSelectSpecimen?: (id: string) => void;
  onCorrectMatch?: (id: string) => void;
  onWrongMatch?: (id: string) => void;
  onViewComps?: (id: string) => void;
  onAddToCollection?: (specimenId: string) => void;
  onExclude?: (id: string) => void;
  onConfirmCatalogCandidate?: (specimenId: string, candidate: CatalogCandidate) => void;
  onRejectCatalogCandidate?: (specimenId: string, catalogId: string) => void;
  onRefreshCatalogCandidates?: (specimenId: string) => void;
  onOpenMasterCatalog?: () => void;
  catalogRefreshingId?: string | null;
  catalogBusy?: boolean;
};

export function ChatMessageList({
  messages,
  specimens = [],
  sessionSummary = null,
  cardHandlers,
  companion,
  onCatalogScanPrefill,
  onOpenSlabzRipInScan,
  onDismissMessage,
  digitalScanOn,
  digitalScanAssets,
  digitalScanRendering,
  digitalScanProgress,
  digitalScanSessionTitle,
  onDownloadDigitalScanZip,
  onSaveDigitalScansToVault,
  onDownloadSingleDigitalScan,
  vaultSaving,
  scanPipelineActive = false,
  scanProgressLabel = null,
  scanSessionKey = null,
  className,
}: {
  messages: ChatMessage[];
  specimens?: ScanSpecimen[];
  sessionSummary?: ScanSummary | null;
  cardHandlers?: CardInteractionHandlers;
  companion?: CompanionController;
  onCatalogScanPrefill?: (prefill: CatalogScanPrefill) => void;
  onOpenSlabzRipInScan?: (rip: SlabzRipRecord, pack: SlabzPack | null) => void;
  onDismissMessage?: (messageId: string) => void;
  digitalScanOn?: boolean;
  digitalScanAssets?: import("@/lib/digital-scan/types").DigitalScanAsset[];
  digitalScanRendering?: boolean;
  digitalScanProgress?: { done: number; total: number; currentLabel?: string } | null;
  digitalScanSessionTitle?: string;
  onDownloadDigitalScanZip?: (includeAttestation?: boolean) => void;
  onSaveDigitalScansToVault?: () => void;
  onDownloadSingleDigitalScan?: (asset: import("@/lib/digital-scan/types").DigitalScanAsset) => void;
  vaultSaving?: boolean;
  /** Vision + enrich in flight — drives evolution pipeline UI. */
  scanPipelineActive?: boolean;
  scanProgressLabel?: string | null;
  scanSessionKey?: string | null;
  className?: string;
}) {
  const systemSteps = messages.filter((m): m is SystemChatMessage => m.role === "system");
  const pendingScan = messages.find(
    (m): m is Extract<ChatMessage, { role: "assistant" }> =>
      m.role === "assistant" && m.id === "pending-result" && Boolean(m.streaming),
  );
  const showTimeline =
    scanPipelineActive &&
    (systemSteps.length > 0 || Boolean(pendingScan)) &&
    (systemSteps.some((s) => s.active || s.done) || Boolean(pendingScan));
  const pipelineStatusText = pendingScan?.text ?? scanProgressLabel ?? null;

  return (
    <div className={cn("space-y-2.5 sm:space-y-4 lg:space-y-6", className)}>
      {messages.map((msg) => {
        if (msg.role === "user") {
          return <UserMessage key={msg.id} message={msg} />;
        }
        if (msg.role === "assistant") {
          return (
            <AIStreamingScanMessage
              key={msg.id}
              message={msg}
              specimens={specimens}
              sessionSummary={sessionSummary}
              cardHandlers={cardHandlers}
              companion={companion}
              onCatalogScanPrefill={onCatalogScanPrefill}
              onOpenSlabzRipInScan={onOpenSlabzRipInScan}
              onDismissOutput={
                msg.output && onDismissMessage ? () => onDismissMessage(msg.id) : undefined
              }
              onDismissHowTo={
                msg.digitalScanHowTo && onDismissMessage
                  ? () => onDismissMessage(msg.id)
                  : undefined
              }
              digitalScanOn={digitalScanOn}
              digitalScanAssets={digitalScanAssets}
              digitalScanRendering={digitalScanRendering}
              digitalScanProgress={digitalScanProgress}
              digitalScanSessionTitle={digitalScanSessionTitle}
              onDownloadDigitalScanZip={onDownloadDigitalScanZip}
              onSaveDigitalScansToVault={onSaveDigitalScansToVault}
              onDownloadSingleDigitalScan={onDownloadSingleDigitalScan}
              vaultSaving={vaultSaving}
              hidePipelineNarrative={showTimeline && pendingScan?.id === msg.id}
            />
          );
        }
        return null;
      })}
      {showTimeline ? (
        <ScanProgressTimeline
          steps={systemSteps}
          bootstrapping={Boolean(pendingScan) && systemSteps.length === 0}
          statusText={pipelineStatusText}
          scanSessionKey={scanSessionKey}
          className="max-w-xl"
        />
      ) : null}
    </div>
  );
}
