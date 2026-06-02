"use client";

import { cn } from "@/lib/cn";

import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1]) {
      parts.push(
        <strong key={key++} className="font-semibold text-slate-100">
          {match[1]}
        </strong>,
      );
    } else if (match[2] && match[3]) {
      parts.push(
        <a
          key={key++}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 underline decoration-sky-500/40 hover:text-sky-300"
        >
          {match[2]}
        </a>,
      );
    } else if (match[4]) {
      parts.push(
        <a
          key={key++}
          href={match[4]}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sky-400 underline decoration-sky-500/40 hover:text-sky-300"
        >
          {match[4].length > 48 ? `${match[4].slice(0, 45)}…` : match[4]}
        </a>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function LiquidAskMarkdown({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n\n+/).filter((b) => b.trim());

  function sectionAccent(heading: string): string | null {
    const h = heading.toLowerCase();
    if (h.includes("your move") || h.includes("collection angle")) {
      return "border-l-2 border-amber-400/40 pl-3";
    }
    if (h.includes("recent sold") || h.includes("live listing")) {
      return "border-l-2 border-emerald-400/30 pl-3";
    }
    if (h.includes("market read") || h.includes("sentiment")) {
      return "border-l-2 border-sky-400/30 pl-3";
    }
    if (h.includes("confidence")) {
      return "border-l-2 border-violet-400/30 pl-3";
    }
    return null;
  }

  return (
    <div className={cn("space-y-3 text-sm leading-relaxed text-slate-200", className)}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const trimmed = block.trim();

        const imageMatch = trimmed.match(/^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)$/);
        if (imageMatch) {
          const [, alt, src] = imageMatch;
          return (
            <figure key={bi} className="overflow-hidden rounded-xl ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={alt ?? ""} className="mx-auto max-h-48 w-auto object-contain bg-black/30 p-2" />
              {alt ? <figcaption className="px-2 pb-2 text-center text-[10px] text-slate-500">{alt}</figcaption> : null}
            </figure>
          );
        }

        const isList = lines.every((l) => /^\s*[-•*]\s+/.test(l) || l.trim() === "");
        if (isList && lines.some((l) => /^\s*[-•*]\s+/.test(l))) {
          return (
            <ul key={bi} className="list-disc space-y-1.5 pl-5 text-slate-300">
              {lines
                .filter((l) => /^\s*[-•*]\s+/.test(l))
                .map((l, li) => (
                  <li key={li}>{renderInline(l.replace(/^\s*[-•*]\s+/, ""))}</li>
                ))}
            </ul>
          );
        }
        if (lines.length > 1) {
          return (
            <div key={bi} className="space-y-2">
              {lines.map((line, li) => (
                <p key={li}>{renderInline(line)}</p>
              ))}
            </div>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={bi} className="text-xs font-semibold uppercase tracking-wider text-emerald-200/90">
              {trimmed.slice(4)}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          const title = trimmed.slice(3);
          const accent = sectionAccent(title);
          return (
            <h3
              key={bi}
              className={cn(
                "text-sm font-semibold text-slate-100",
                accent,
              )}
            >
              {title}
            </h3>
          );
        }
        return <p key={bi}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}
