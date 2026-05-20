"use client";

import { cn } from "@/lib/cn";

export function Pokeball({
  className,
  pulse,
  shake,
}: {
  className?: string;
  pulse?: boolean;
  /** Scanner upload stage — side-to-side wobble */
  shake?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative aspect-square w-full max-w-[4.5rem] select-none",
        pulse && "animate-[companion-ball-pulse_1.4s_ease-in-out_infinite]",
        shake && "scanner-pokeball-shake",
        className,
      )}
    >
      <span className="pointer-events-none absolute -inset-1 rounded-full border border-white/10 bg-gradient-to-br from-white/10 to-transparent" />
      <div className="absolute inset-[8%] overflow-hidden rounded-full border-2 border-[#1a1a1a] shadow-[inset_0_-6px_12px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-x-0 top-0 h-[46%] bg-[#ef4444]" />
        <div className="absolute inset-x-0 top-[46%] h-[8%] bg-[#1a1a1a]" />
        <div className="absolute inset-x-0 bottom-0 h-[46%] bg-white" />
        <div className="absolute left-1/2 top-1/2 z-10 h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#1a1a1a] bg-white shadow-[0_0_0_2px_rgba(255,255,255,0.5)]">
          <div className="absolute inset-[18%] rounded-full bg-gradient-to-br from-slate-100 to-slate-300" />
        </div>
      </div>
    </div>
  );
}
