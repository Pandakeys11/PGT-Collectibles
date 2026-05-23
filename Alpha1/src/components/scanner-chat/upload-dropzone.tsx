"use client";

import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/cn";

export function UploadDropzoneOverlay({
  onFiles,
  disabled,
  queuedCount = 0,
}: {
  onFiles: (files: FileList | File[]) => void;
  disabled?: boolean;
  /** Images waiting for the current scan to finish. */
  queuedCount?: number;
}) {
  const [dragOver, setDragOver] = useState(false);
  const dropLocked = disabled || queuedCount > 0;

  return (
    <div
      className={cn(
        "fixed inset-0 z-20",
        dragOver && !dropLocked ? "pointer-events-auto" : "pointer-events-none",
      )}
      onDragEnter={(e) => {
        if (dropLocked) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (dropLocked) e.dataTransfer.dropEffect = "none";
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (dropLocked || !e.dataTransfer.files.length) return;
        onFiles(e.dataTransfer.files);
      }}
    >
      {dragOver && !dropLocked ? (
        <div className="flex h-full items-center justify-center bg-black/40 backdrop-blur-md">
          <div className="sc-glow-border rounded-2xl sc-glass-raised px-10 py-8 text-center">
            <ImagePlus className="mx-auto h-12 w-12 text-sky-400" />
            <p className="mt-3 font-medium text-slate-100">Release to add images</p>
            <p className="mt-1 text-sm text-slate-500">Binder pages, slabs, or singles</p>
          </div>
        </div>
      ) : null}
      {disabled && queuedCount > 0 ? (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
          {queuedCount} image{queuedCount === 1 ? "" : "s"} queued — will attach when scan finishes
        </div>
      ) : null}
    </div>
  );
}
