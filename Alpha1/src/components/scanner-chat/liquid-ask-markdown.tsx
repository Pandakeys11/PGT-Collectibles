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

  return (
    <div className={cn("space-y-3 text-sm leading-relaxed text-slate-200", className)}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
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
        const trimmed = block.trim();
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={bi} className="text-xs font-semibold uppercase tracking-wider text-emerald-200/90">
              {trimmed.slice(4)}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={bi} className="text-sm font-semibold text-slate-100">
              {trimmed.slice(3)}
            </h3>
          );
        }
        return <p key={bi}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}
