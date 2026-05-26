"use client";

import { motion, Reorder, useDragControls } from "framer-motion";
import { GripVertical, Maximize2, X } from "lucide-react";
import { ImageLightbox, ExpandableImageThumb } from "@/components/ui/image-lightbox";
import type { UploadedImage } from "@/lib/scanner-chat/types";
import { useUploadImageLightbox } from "./use-upload-image-lightbox";
import { cn } from "@/lib/cn";

function PreviewStripItem({
  img,
  index,
  scanning,
  compact,
  gallery,
  galleryIndex,
  onOpenGallery,
  onRemove,
}: {
  img: UploadedImage;
  index: number;
  scanning?: boolean;
  compact?: boolean;
  gallery: ReturnType<typeof useUploadImageLightbox>["gallery"];
  galleryIndex: number;
  onOpenGallery: (index: number) => void;
  onRemove: (id: string) => void;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={img}
      dragListener={false}
      dragControls={dragControls}
      className="group relative shrink-0"
    >
      <motion.div layout className="relative">
        <ExpandableImageThumb
          src={img.previewUrl}
          alt={`Upload ${index + 1}`}
          gallery={gallery}
          galleryIndex={galleryIndex}
          onOpenGallery={onOpenGallery}
          className={cn(
            "sc-glow-border",
            compact ? "h-14 w-14" : "h-16 w-16 sm:h-20 sm:w-20",
            scanning && "sc-laser-scan shadow-[0_0_12px_rgba(34,211,238,0.2)]",
          )}
        >
          <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-md bg-black/55 text-white/90 opacity-80 transition lg:opacity-0 lg:group-hover:opacity-100">
            <Maximize2 className="h-3 w-3" aria-hidden />
          </span>
        </ExpandableImageThumb>

        <button
          type="button"
          onPointerDown={(e) => dragControls.start(e)}
          className="absolute bottom-1 left-1 flex h-6 w-6 cursor-grab items-center justify-center rounded-md bg-black/55 text-white/70 touch-manipulation active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(img.id);
          }}
          className="absolute -right-1 -top-1 z-[2] flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-slate-300 ring-1 ring-white/10 transition hover:bg-red-500/90 hover:text-white touch-manipulation"
          aria-label="Remove image"
        >
          <X className="h-3 w-3" />
        </button>
      </motion.div>
    </Reorder.Item>
  );
}

export function ImagePreviewStrip({
  images,
  onRemove,
  onReorder,
  scanning,
  compact = false,
  className,
}: {
  images: UploadedImage[];
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  scanning?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const lightbox = useUploadImageLightbox(images);

  if (!images.length) return null;

  return (
    <>
      <Reorder.Group
        axis="x"
        values={images}
        onReorder={(next) => {
          if (next.length !== images.length) return;
          const movedId = next.find((item, i) => item.id !== images[i]?.id)?.id;
          if (!movedId) return;
          const from = images.findIndex((i) => i.id === movedId);
          const to = next.findIndex((i) => i.id === movedId);
          if (from >= 0 && to >= 0 && from !== to) onReorder(from, to);
        }}
        className={cn("flex gap-2 overflow-x-auto pb-1 scanner-chat-scrollbar", className)}
      >
        {images.map((img, index) => (
          <PreviewStripItem
            key={img.id}
            img={img}
            index={index}
            scanning={scanning}
            compact={compact}
            gallery={lightbox.gallery}
            galleryIndex={index}
            onOpenGallery={lightbox.openAt}
            onRemove={onRemove}
          />
        ))}
      </Reorder.Group>

      <ImageLightbox
        open={lightbox.open}
        onClose={lightbox.close}
        src={null}
        alt=""
        gallery={lightbox.gallery}
        galleryIndex={lightbox.index}
        onGalleryIndexChange={lightbox.setIndex}
      />
    </>
  );
}
