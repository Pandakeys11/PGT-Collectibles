"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Swords } from "lucide-react";
import { CompanionBattleMiniCard } from "@/components/companion/companion-battle-mini-card";
import { ScanPipelineHoloText } from "@/components/scanner-chat/scan-pipeline-holo-text";
import {
  advanceIntro,
  applyMove,
  runEnemyTurn,
  type BattleState,
  typeBadgeColor,
} from "@/lib/companion/battle-engine";
import { cn } from "@/lib/cn";

const END_SCREEN_MS = 2800;
const ENEMY_TURN_MS = 900;

export function CompanionBattleArena({
  initial,
  onFinish,
  className,
}: {
  initial: BattleState;
  onFinish: (won: boolean) => void;
  className?: string;
}) {
  const [battle, setBattle] = useState<BattleState>(initial);
  const [introIdx, setIntroIdx] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const teamRocket = battle.encounter === "team_rocket";
  const playerTurn = battle.phase === "player" && !battle.winner;
  const resolving = battle.phase === "resolving";

  useEffect(() => {
    if (battle.phase !== "intro") return;
    if (introIdx >= battle.introLines.length - 1) {
      const t = window.setTimeout(() => {
        setBattle((b) => advanceIntro(b));
      }, 1400);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setIntroIdx((i) => i + 1), 1100);
    return () => window.clearTimeout(t);
  }, [battle.phase, battle.introLines.length, introIdx]);

  useEffect(() => {
    if (battle.phase !== "ended" || !battle.winner || finishing) return;
    setFinishing(true);
    const t = window.setTimeout(() => {
      onFinish(battle.winner === "player");
    }, END_SCREEN_MS);
    return () => window.clearTimeout(t);
  }, [battle.phase, battle.winner, finishing, onFinish]);

  const handlePlayerMove = useCallback(
    (moveIndex: number) => {
      if (!playerTurn || resolving) return;
      setBattle((prev) => {
        const afterPlayer = applyMove(prev, "player", moveIndex);
        if (afterPlayer.winner) return afterPlayer;
        return { ...afterPlayer, phase: "resolving" };
      });
    },
    [playerTurn, resolving],
  );

  useEffect(() => {
    if (battle.phase !== "resolving" || battle.winner) return;
    const t = window.setTimeout(() => {
      setBattle((prev) => runEnemyTurn(prev));
    }, ENEMY_TURN_MS);
    return () => window.clearTimeout(t);
  }, [battle.phase, battle.winner, battle.log.length]);

  const introLine = battle.introLines[introIdx] ?? battle.turnMessage;

  return (
    <div className={cn("sc-companion-battle-arena mx-auto w-full max-w-[22rem]", className)}>
      <article className="sc-scan-tcg-card sc-companion-battle-arena__frame sc-glow-border overflow-hidden rounded-[0.65rem]">
        <header
          className={cn(
            "flex items-center justify-between gap-2 px-2.5 py-1.5",
            teamRocket
              ? "bg-gradient-to-r from-rose-700/95 via-slate-900 to-indigo-950/90"
              : "bg-gradient-to-r from-rose-800/90 via-slate-900 to-violet-950/80",
          )}
        >
          <div className="flex items-center gap-1.5">
            <Swords className="h-3.5 w-3.5 text-white/90" aria-hidden />
            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/95">
              {teamRocket ? "Team Rocket Battle" : "Wild Battle"}
            </span>
          </div>
          <span className="rounded bg-black/35 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/80">
            GB Mode
          </span>
        </header>

        <div className="sc-companion-battle-arena__field space-y-2 p-2">
          {teamRocket && battle.phase === "intro" ? (
            <div className="sc-companion-battle-rocket-banner rounded-lg border border-rose-500/40 bg-gradient-to-r from-rose-950/80 via-black to-indigo-950/70 px-2 py-2 text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-rose-300">
                Team Rocket
              </p>
              <p className="mt-1 text-[10px] font-semibold text-white">Jessie · James · Meowth</p>
            </div>
          ) : null}

          <CompanionBattleMiniCard
            fighter={battle.enemy}
            side="enemy"
            trainerLabel={battle.enemyTrainer}
            subLabel={battle.enemySubLabel}
            teamRocket={teamRocket}
          />

          <div className="sc-companion-battle-log min-h-[4.5rem] rounded-md border border-white/8 bg-black/50 px-2 py-2">
            <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Battle log
            </p>
            <AnimatePresence mode="wait">
              <motion.div
                key={battle.phase === "intro" ? `intro-${introIdx}` : battle.turnMessage}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {battle.phase === "intro" ? (
                  <ScanPipelineHoloText as="p" className="text-[11px] font-semibold" fast>
                    {introLine}
                  </ScanPipelineHoloText>
                ) : battle.phase === "ended" && battle.winner ? (
                  <ScanPipelineHoloText as="p" className="text-[11px] font-semibold" fast>
                    {battle.winner === "player"
                      ? "You won the battle!"
                      : `${battle.player.name} was defeated…`}
                  </ScanPipelineHoloText>
                ) : (
                  <ScanPipelineHoloText as="p" className="text-[11px] font-semibold" fast>
                    {battle.turnMessage}
                  </ScanPipelineHoloText>
                )}
              </motion.div>
            </AnimatePresence>
            {battle.log.length > 0 && battle.phase !== "intro" ? (
              <ul className="mt-2 max-h-16 space-y-0.5 overflow-y-auto border-t border-white/6 pt-2 scanner-chat-scrollbar">
                {battle.log.slice(-4).map((line, i) => (
                  <li key={`${i}-${line}`} className="text-[9px] leading-snug text-slate-500">
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {playerTurn ? (
            <div className="space-y-1">
              <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Choose attack
              </p>
              <div className="grid grid-cols-2 gap-1">
                {battle.player.moves.map((move, i) => (
                  <button
                    key={move.id}
                    type="button"
                    disabled={move.pp <= 0 || resolving}
                    onClick={() => handlePlayerMove(i)}
                    className={cn(
                      "sc-companion-battle-move flex flex-col items-start rounded-md border px-2 py-1.5 text-left transition active:scale-[0.98] disabled:opacity-40",
                      typeBadgeColor(move.type),
                    )}
                  >
                    <span className="text-[10px] font-bold leading-tight">{move.name}</span>
                    <span className="mt-0.5 flex w-full items-center justify-between gap-1 text-[8px] uppercase opacity-80">
                      <span>{move.type}</span>
                      <span className="font-mono">PP {move.pp}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : resolving ? (
            <div className="flex items-center justify-center gap-2 py-2 text-[10px] text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Foe is attacking…
            </div>
          ) : null}

          <CompanionBattleMiniCard
            fighter={battle.player}
            side="player"
            trainerLabel="Your partner"
            subLabel={`Lv ${battle.player.level}`}
          />
        </div>
      </article>
    </div>
  );
}
