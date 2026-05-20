"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Minus, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER,
  clampCropRadiusMultiplier,
  CROP_RADIUS_MULT_MAX,
  CROP_RADIUS_MULT_MIN,
  CROP_RADIUS_MULT_STEP,
  visionLocationToCropRectPx,
  type EvidenceCropAdjustment,
} from "@/lib/scan/specimen-crop";
import { cn } from "@/lib/cn";
import type { VisionGridLocation } from "@/lib/scan/spatial";

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_WHEEL_FACTOR = 1.08;

const CORNERS = ["nw", "ne", "sw", "se"] as const;
type CornerId = (typeof CORNERS)[number];

const CORNER_CURSOR: Record<CornerId, string> = {
  nw: "cursor-nwse-resize",
  se: "cursor-nwse-resize",
  ne: "cursor-nesw-resize",
  sw: "cursor-nesw-resize",
};

const CORNER_POS: Record<CornerId, string> = {
  nw: "-left-2.5 -top-2.5",
  ne: "-right-2.5 -top-2.5",
  sw: "-left-2.5 -bottom-2.5",
  se: "-right-2.5 -bottom-2.5",
};

function effectiveCenter(
  user: VisionGridLocation | null | undefined,
  auto: VisionGridLocation | null | undefined,
): VisionGridLocation {
  if (user) return user;
  if (auto) return auto;
  return [500, 500] as const;
}

function effectiveRadius(user: number | null | undefined): number {
  return user != null
    ? clampCropRadiusMultiplier(user)
    : CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER;
}

function clampGrid(v: number): number {
  return Math.round(Math.max(0, Math.min(1000, v)));
}

type ImageLayout = {
  nw: number;
  nh: number;
  scale: number;
  dispW: number;
  dispH: number;
};

type FrameDrag =
  | {
      kind: "resize";
      startMult: number;
      startDist: number;
      centerX: number;
      centerY: number;
    }
  | {
      kind: "move";
      startCenter: VisionGridLocation;
      startGx: number;
      startGy: number;
    };

type ZoomAnchor = {
  x: number;
  y: number;
  vpLeft: number;
  vpTop: number;
  scrollLeft: number;
  scrollTop: number;
  zoom: number;
};

function computeLayout(
  nw: number,
  nh: number,
  viewportW: number,
  viewportH: number,
  zoom: number,
): ImageLayout | null {
  if (nw < 2 || nh < 2 || viewportW < 2 || viewportH < 2) return null;
  const margin = 8;
  const innerW = Math.max(2, viewportW - margin * 2);
  const innerH = Math.max(2, viewportH - margin * 2);
  const fitUncapped = Math.min(innerW / nw, innerH / nh);
  const fit = Math.min(1, fitUncapped);
  const scale = fit * zoom;
  return { nw, nh, scale, dispW: nw * scale, dispH: nh * scale };
}

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  display,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
  onChange,
  className,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onDec: () => void;
  onInc: () => void;
  decDisabled: boolean;
  incDisabled: boolean;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="w-12 text-xs text-muted">{label}</span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8 w-8 shrink-0 p-0"
        aria-label={`${label} decrease`}
        disabled={decDisabled}
        onClick={onDec}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </Button>
      <input
        type="range"
        className="h-2 w-[min(36vw,11rem)] cursor-pointer accent-accent"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8 w-8 shrink-0 p-0"
        aria-label={`${label} increase`}
        disabled={incDisabled}
        onClick={onInc}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </Button>
      <span className="font-mono text-[11px] text-muted tabular-nums">
        {display}
      </span>
    </div>
  );
}

export function EvidenceCropDialog({
  open,
  onOpenChange,
  imageSrc,
  userCenter,
  userRadiusMultiplier,
  autoCenter,
  gradedSlab,
  rescanning,
  onApply,
  onResyncWithCrop,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  userCenter: VisionGridLocation | null | undefined;
  userRadiusMultiplier?: number | null;
  autoCenter: VisionGridLocation | null | undefined;
  gradedSlab?: boolean;
  rescanning?: boolean;
  onApply: (crop: EvidenceCropAdjustment | null) => void;
  onResyncWithCrop?: (crop: EvidenceCropAdjustment) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const frameDragRef = useRef<FrameDrag | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const zoomAnchorRef = useRef<ZoomAnchor | null>(null);

  const [draftCenter, setDraftCenter] = useState<VisionGridLocation>(() =>
    effectiveCenter(userCenter, autoCenter),
  );
  const [draftRadius, setDraftRadius] = useState(() =>
    effectiveRadius(userRadiusMultiplier),
  );
  const [layout, setLayout] = useState<ImageLayout | null>(null);
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [isDraggingFrame, setIsDraggingFrame] = useState(false);

  const hasManualCrop = userCenter != null || userRadiusMultiplier != null;

  const measure = useCallback(() => {
    const img = imgRef.current;
    const vp = viewportRef.current;
    if (!img || !vp) return;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (nw < 2 || nh < 2) return;
    setLayout(computeLayout(nw, nh, vp.clientWidth, vp.clientHeight, zoom));
  }, [zoom]);

  const clientToGrid = useCallback(
    (clientX: number, clientY: number): VisionGridLocation | null => {
      const img = imgRef.current;
      if (!img || !layout) return null;
      const rect = img.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const { nw, nh, scale } = layout;
      if (
        localX < 0 ||
        localY < 0 ||
        localX > rect.width ||
        localY > rect.height
      )
        return null;
      const gx = clampGrid((localX / scale / nw) * 1000);
      const gy = clampGrid((localY / scale / nh) * 1000);
      return [gy, gx] as const;
    },
    [layout],
  );

  useEffect(() => {
    if (open) {
      setDraftCenter(effectiveCenter(userCenter, autoCenter));
      setDraftRadius(effectiveRadius(userRadiusMultiplier));
      setZoom(ZOOM_MIN);
      zoomAnchorRef.current = null;
    }
  }, [open, userCenter, userRadiusMultiplier, autoCenter]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const img = imgRef.current;
    const vp = viewportRef.current;
    const wrap = wrapRef.current;
    if (!img || !vp || !wrap) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(img);
    ro.observe(vp);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [open, imageSrc, measure]);

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    const vp = viewportRef.current;
    if (!anchor || !vp) return;
    const ratio = zoom / anchor.zoom;
    if (Math.abs(ratio - 1) < 0.001) {
      zoomAnchorRef.current = null;
      return;
    }
    vp.scrollLeft =
      anchor.scrollLeft * ratio + (anchor.x - anchor.vpLeft) * (ratio - 1);
    vp.scrollTop =
      anchor.scrollTop * ratio + (anchor.y - anchor.vpTop) * (ratio - 1);
    zoomAnchorRef.current = null;
  }, [zoom]);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const setZoomAtClient = useCallback(
    (clientX: number, clientY: number, nextZoom: number) => {
      const vp = viewportRef.current;
      const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
      if (!vp || Math.abs(clamped - zoomRef.current) < 0.001) return;
      const rect = vp.getBoundingClientRect();
      zoomAnchorRef.current = {
        x: clientX,
        y: clientY,
        vpLeft: rect.left,
        vpTop: rect.top,
        scrollLeft: vp.scrollLeft,
        scrollTop: vp.scrollTop,
        zoom: zoomRef.current,
      };
      setZoom(clamped);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    let cleaned = false;
    const holder: {
      root: HTMLDivElement | null;
      onTouchStart: ((e: TouchEvent) => void) | null;
      onTouchMove: ((e: TouchEvent) => void) | null;
      onTouchEnd: (() => void) | null;
    } = { root: null, onTouchStart: null, onTouchMove: null, onTouchEnd: null };

    const attach = () => {
      const root = viewportRef.current;
      if (!root || cleaned) return;
      holder.root = root;

      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          const a = e.touches[0];
          const b = e.touches[1];
          pinchRef.current = {
            dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
            zoom: zoomRef.current,
          };
        }
      };

      const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length > 1) e.preventDefault();
        if (e.touches.length !== 2 || !pinchRef.current) return;
        const a = e.touches[0];
        const b = e.touches[1];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const { dist: d0, zoom: z0 } = pinchRef.current;
        if (d0 < 4) return;
        const midX = (a.clientX + b.clientX) / 2;
        const midY = (a.clientY + b.clientY) / 2;
        setZoomAtClient(midX, midY, (z0 * dist) / d0);
      };

      const onTouchEnd = () => {
        pinchRef.current = null;
      };

      holder.onTouchStart = onTouchStart;
      holder.onTouchMove = onTouchMove;
      holder.onTouchEnd = onTouchEnd;

      root.addEventListener("touchstart", onTouchStart, { passive: true });
      root.addEventListener("touchmove", onTouchMove, { passive: false });
      root.addEventListener("touchend", onTouchEnd);
      root.addEventListener("touchcancel", onTouchEnd);
    };

    const raf = requestAnimationFrame(attach);
    return () => {
      cleaned = true;
      cancelAnimationFrame(raf);
      const { root, onTouchStart, onTouchMove, onTouchEnd } = holder;
      if (root && onTouchStart && onTouchMove && onTouchEnd) {
        root.removeEventListener("touchstart", onTouchStart);
        root.removeEventListener("touchmove", onTouchMove);
        root.removeEventListener("touchend", onTouchEnd);
        root.removeEventListener("touchcancel", onTouchEnd);
      }
    };
  }, [open, setZoomAtClient]);

  const bumpZoom = useCallback(
    (delta: number) => {
      const vp = viewportRef.current;
      const rect = vp?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width / 2 : 0;
      const cy = rect ? rect.top + rect.height / 2 : 0;
      setZoomAtClient(cx, cy, zoomRef.current + delta);
    },
    [setZoomAtClient],
  );

  const onViewportWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (frameDragRef.current) return;
      event.preventDefault();
      const factor =
        event.deltaY > 0 ? 1 / ZOOM_WHEEL_FACTOR : ZOOM_WHEEL_FACTOR;
      setZoomAtClient(event.clientX, event.clientY, zoomRef.current * factor);
    },
    [setZoomAtClient],
  );

  const onImageClick = useCallback(
    (event: React.MouseEvent<HTMLImageElement>) => {
      if (frameDragRef.current || isDraggingFrame) return;
      const grid = clientToGrid(event.clientX, event.clientY);
      if (grid) setDraftCenter(grid);
    },
    [clientToGrid, isDraggingFrame],
  );

  const cropPx = useMemo(
    () =>
      layout && draftCenter
        ? visionLocationToCropRectPx(layout.nw, layout.nh, draftCenter, {
            gradedSlab: Boolean(gradedSlab),
            radiusMultiplier: draftRadius,
          })
        : null,
    [draftCenter, draftRadius, gradedSlab, layout],
  );

  const overlayStyle = useMemo(
    () =>
      layout && cropPx
        ? {
            left: cropPx.sx * layout.scale,
            top: cropPx.sy * layout.scale,
            width: cropPx.sw * layout.scale,
            height: cropPx.sh * layout.scale,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.42)",
          }
        : null,
    [cropPx, layout],
  );

  const getFrameCenterClient = useCallback(() => {
    if (!overlayStyle || !wrapRef.current) return null;
    const wrapRect = wrapRef.current.getBoundingClientRect();
    const left = wrapRect.left + (overlayStyle.left as number);
    const top = wrapRect.top + (overlayStyle.top as number);
    const w = overlayStyle.width as number;
    const h = overlayStyle.height as number;
    return { cx: left + w / 2, cy: top + h / 2 };
  }, [overlayStyle]);

  const onFramePointerDown = useCallback(
    (event: React.PointerEvent) => {
      const target = event.target as HTMLElement;
      if (target.dataset.corner) return;
      event.preventDefault();
      event.stopPropagation();
      const grid = clientToGrid(event.clientX, event.clientY);
      if (!grid) return;
      frameDragRef.current = {
        kind: "move",
        startCenter: draftCenter,
        startGx: grid[1],
        startGy: grid[0],
      };
      setIsDraggingFrame(true);
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    [clientToGrid, draftCenter],
  );

  const onCornerPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const center = getFrameCenterClient();
      if (!center) return;
      const dist = Math.max(
        28,
        Math.hypot(event.clientX - center.cx, event.clientY - center.cy),
      );
      frameDragRef.current = {
        kind: "resize",
        startMult: draftRadius,
        startDist: dist,
        centerX: center.cx,
        centerY: center.cy,
      };
      setIsDraggingFrame(true);
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    [draftRadius, getFrameCenterClient],
  );

  const onFramePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = frameDragRef.current;
      if (!drag) return;

      if (drag.kind === "resize") {
        const dist = Math.max(
          20,
          Math.hypot(
            event.clientX - drag.centerX,
            event.clientY - drag.centerY,
          ),
        );
        setDraftRadius(
          clampCropRadiusMultiplier(drag.startMult * (dist / drag.startDist)),
        );
        return;
      }

      const grid = clientToGrid(event.clientX, event.clientY);
      if (!grid) return;
      const dx = grid[1] - drag.startGx;
      const dy = grid[0] - drag.startGy;
      setDraftCenter([
        clampGrid(drag.startCenter[0] + dy),
        clampGrid(drag.startCenter[1] + dx),
      ] as const);
    },
    [clientToGrid],
  );

  const onFramePointerUp = useCallback((event: React.PointerEvent) => {
    frameDragRef.current = null;
    setIsDraggingFrame(false);
    const el = event.currentTarget as HTMLElement;
    if (el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
  }, []);

  const currentCrop = (): EvidenceCropAdjustment => ({
    center: draftCenter,
    radiusMultiplier: clampCropRadiusMultiplier(draftRadius),
  });

  const apply = () => {
    onApply(currentCrop());
    onOpenChange(false);
  };

  const resync = () => {
    if (!onResyncWithCrop || rescanning) return;
    onResyncWithCrop(currentCrop());
    onOpenChange(false);
  };

  const framePct = Math.round(
    (draftRadius / CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER) * 100,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(94dvh,48rem)] w-[min(96vw,48rem)] overflow-y-auto p-4 sm:p-6">
        <DialogTitle>Adjust evidence crop</DialogTitle>
        <DialogDescription id="crop-help">
          Drag the frame to move it, drag any corner to resize, or tap the image
          to re-center. Scroll or pinch to zoom (stays under your
          cursor/fingers). This region is used for evidence and Resync.
        </DialogDescription>

        <SliderRow
          label="Zoom"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.05}
          value={zoom}
          display={`${Math.round(zoom * 100)}%`}
          onDec={() => bumpZoom(-0.15)}
          onInc={() => bumpZoom(0.15)}
          decDisabled={zoom <= ZOOM_MIN}
          incDisabled={zoom >= ZOOM_MAX}
          onChange={(v) => {
            const vp = viewportRef.current;
            const rect = vp?.getBoundingClientRect();
            setZoomAtClient(
              rect ? rect.left + rect.width / 2 : 0,
              rect ? rect.top + rect.height / 2 : 0,
              v,
            );
          }}
          className="mt-3"
        />

        <SliderRow
          label="Frame"
          min={CROP_RADIUS_MULT_MIN}
          max={CROP_RADIUS_MULT_MAX}
          step={CROP_RADIUS_MULT_STEP}
          value={draftRadius}
          display={`${framePct}%`}
          onDec={() =>
            setDraftRadius((r) =>
              clampCropRadiusMultiplier(r - CROP_RADIUS_MULT_STEP),
            )
          }
          onInc={() =>
            setDraftRadius((r) =>
              clampCropRadiusMultiplier(r + CROP_RADIUS_MULT_STEP),
            )
          }
          decDisabled={draftRadius <= CROP_RADIUS_MULT_MIN}
          incDisabled={draftRadius >= CROP_RADIUS_MULT_MAX}
          onChange={(v) => setDraftRadius(clampCropRadiusMultiplier(v))}
          className="mt-2"
        />

        <CropViewport
          viewportRef={viewportRef}
          wrapRef={wrapRef}
          imgRef={imgRef}
          imageSrc={imageSrc}
          layout={layout}
          overlayStyle={overlayStyle}
          isDraggingFrame={isDraggingFrame}
          onImageClick={onImageClick}
          onLoad={measure}
          onViewportWheel={onViewportWheel}
          onFramePointerDown={onFramePointerDown}
          onFramePointerMove={onFramePointerMove}
          onFramePointerUp={onFramePointerUp}
          onCornerPointerDown={onCornerPointerDown}
        />

        <p className="mt-2 font-mono text-[11px] text-muted">
          Center y,x: {draftCenter[0]}, {draftCenter[1]}
          {layout && cropPx ? (
            <span className="ml-2 text-faint">
              · frame {Math.round(cropPx.sw)}×{Math.round(cropPx.sh)}px on
              source
            </span>
          ) : null}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={apply}>
            Apply crop
          </Button>
          {onResyncWithCrop ? (
            <Button
              type="button"
              variant="secondary"
              className="touch-manipulation"
              disabled={Boolean(rescanning)}
              onClick={resync}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", rescanning && "animate-spin")}
                aria-hidden
              />
              Resync row
            </Button>
          ) : null}
          {hasManualCrop ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onApply(null);
                onOpenChange(false);
              }}
            >
              Clear manual crop
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CropViewport({
  viewportRef,
  wrapRef,
  imgRef,
  imageSrc,
  layout,
  overlayStyle,
  isDraggingFrame,
  onImageClick,
  onLoad,
  onViewportWheel,
  onFramePointerDown,
  onFramePointerMove,
  onFramePointerUp,
  onCornerPointerDown,
}: {
  viewportRef: React.Ref<HTMLDivElement>;
  wrapRef: React.Ref<HTMLDivElement>;
  imgRef: React.Ref<HTMLImageElement>;
  imageSrc: string;
  layout: ImageLayout | null;
  overlayStyle: React.CSSProperties | null;
  isDraggingFrame: boolean;
  onImageClick: (e: React.MouseEvent<HTMLImageElement>) => void;
  onLoad: () => void;
  onViewportWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  onFramePointerDown: (e: React.PointerEvent) => void;
  onFramePointerMove: (e: React.PointerEvent) => void;
  onFramePointerUp: (e: React.PointerEvent) => void;
  onCornerPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      ref={viewportRef}
      className="relative mx-auto mt-2 h-[min(58dvh,36rem)] max-w-full touch-manipulation overflow-auto rounded-xl border border-border-subtle bg-black/50"
      onWheel={onViewportWheel}
    >
      <div className="flex min-h-full w-full min-w-full items-center justify-center p-2">
        <div ref={wrapRef} className="relative inline-block shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Tap to set crop center"
            className={cn(
              "mx-auto block select-none",
              isDraggingFrame ? "cursor-grabbing" : "cursor-crosshair",
              !layout &&
                "max-h-[min(56dvh,34rem)] w-auto max-w-full object-contain",
            )}
            style={
              layout
                ? {
                    width: layout.dispW,
                    height: layout.dispH,
                    maxWidth: "none",
                    maxHeight: "none",
                  }
                : undefined
            }
            onClick={onImageClick}
            onLoad={onLoad}
            draggable={false}
          />
          {overlayStyle ? (
            <div
              className={cn(
                "absolute rounded-xl border-2 border-accent ring-2 ring-accent/40 touch-none",
                isDraggingFrame ? "cursor-grabbing" : "cursor-grab",
              )}
              style={overlayStyle}
              onPointerDown={onFramePointerDown}
              onPointerMove={onFramePointerMove}
              onPointerUp={onFramePointerUp}
              onPointerCancel={onFramePointerUp}
            >
              {CORNERS.map((corner) => (
                <button
                  key={corner}
                  type="button"
                  data-corner={corner}
                  aria-label={`Resize frame from ${corner} corner`}
                  className={cn(
                    "absolute z-20 h-6 w-6 rounded-full border-2 border-accent bg-canvas shadow-md touch-manipulation",
                    CORNER_POS[corner],
                    CORNER_CURSOR[corner],
                  )}
                  onPointerDown={onCornerPointerDown}
                  onPointerMove={onFramePointerMove}
                  onPointerUp={onFramePointerUp}
                  onPointerCancel={onFramePointerUp}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
