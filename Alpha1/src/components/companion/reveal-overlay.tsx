"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PokemonSprite } from "@/components/companion/pokemon-sprite";
import { getCompanionPokemon } from "@/lib/companion/pokemon-roster";

export function RevealOverlay({
  open,
  name,
  nationalId,
  slug,
  era,
  tier,
  onDone,
}: {
  open: boolean;
  name: string;
  nationalId: number;
  slug: string;
  era: string;
  tier: string;
  onDone: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDone}
        >
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-cyan-300/30 bg-[#070b10] p-6 text-center shadow-[0_0_80px_-20px_rgba(103,232,249,0.55)]"
            initial={{ scale: 0.85, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(103,232,249,0.2),transparent_55%)]"
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-200">Partner hatched</p>
            <motion.div
              className="relative mx-auto mt-4 grid h-36 w-36 place-items-center"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.15, 1] }}
              transition={{ duration: 0.7, times: [0, 0.7, 1] }}
            >
              <PokemonSprite
                nationalId={nationalId}
                slug={slug}
                name={name}
                types={getCompanionPokemon(nationalId)?.types ?? []}
                display="animated"
                size="lg"
              />
            </motion.div>
            <h3 className="mt-2 font-display text-2xl font-bold text-white">{name}</h3>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
              {era} · {tier}
            </p>
            <button
              type="button"
              onClick={onDone}
              className="mt-6 w-full rounded-lg border border-cyan-300/40 bg-cyan-300/15 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/25"
            >
              Begin care
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
