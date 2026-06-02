import { catalogImageSrc } from "@/lib/ui/catalog-image-url";

const warmed = new Set<string>();
const queue: string[] = [];
let draining = false;

function drainQueue() {
  if (draining || queue.length === 0) return;
  draining = true;

  const run = () => {
    let batch = 0;
    while (queue.length > 0 && batch < 8) {
      const src = queue.shift();
      if (!src || warmed.has(src)) continue;
      warmed.add(src);
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      batch += 1;
    }
    if (queue.length > 0) {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => run());
      } else {
        window.setTimeout(run, 16);
      }
    } else {
      draining = false;
    }
  };

  run();
}

/** Warm browser HTTP cache for card/set artwork (deduped, idle-batched). */
export function prefetchImageUrls(urls: (string | undefined | null)[], limit = 64) {
  if (typeof window === "undefined") return;

  for (const raw of urls) {
    if (queue.length >= limit) break;
    const src = catalogImageSrc(raw);
    if (!src || warmed.has(src)) continue;
    queue.push(src);
  }

  drainQueue();
}
