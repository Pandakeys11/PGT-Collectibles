"use client";

import { motion } from "framer-motion";
import { SlabzPackVisual } from "@/components/scanner-chat/slabz-pack-visual";
import type { SlabzPack } from "@/lib/slabz/types";

export function SlabzRipOpenAnimation({
  pack,
  message,
}: {
  pack: SlabzPack;
  message: string;
}) {
  return (
    <div className="sc-slabz-rip-animation flex flex-col items-center py-5 sm:py-8">
      <motion.div
        animate={{
          rotate: [0, -4, 4, -6, 6, 0],
          scale: [1, 1.04, 0.98, 1.06, 1],
        }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="relative"
      >
        <motion.div
          className="pointer-events-none absolute -inset-4 rounded-3xl bg-cyan-400/25 blur-2xl sm:-inset-8"
          animate={{ opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        <SlabzPackVisual pack={pack} size="showcase" variant="rip" />
      </motion.div>
      <motion.p
        className="mt-5 max-w-[18rem] px-2 text-center text-[11px] font-medium leading-relaxed text-cyan-100/90 sm:max-w-md sm:text-xs"
        animate={{ opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        {message}
      </motion.p>
      <div className="sc-slabz-rip-progress mt-4 h-1.5 w-40 overflow-hidden rounded-full bg-white/10 sm:w-48">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          style={{ width: "45%" }}
        />
      </div>
    </div>
  );
}
