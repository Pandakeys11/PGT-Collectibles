"use client";

import { useCallback, useEffect, useState } from "react";
import { MarketEvidenceTable } from "@/components/scanner/market-evidence-table";
import { MarketSourceHub } from "@/components/scanner/market-source-hub";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { VerificationPill } from "@/components/ui/verification-pill";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { getCardDisplaySubtitle, getCardDisplayTitle } from "@/lib/scan/card-display";
import type { StructuredBrief } from "@/lib/scan/schemas";
import { SpecimenMarketSummary } from "@/components/scanner/specimen-market-summary";

function stripMdBold(s: string): string {
  return s.replace(/\*\*/g, "");
}

async function readSseStream(
  response: Response,
  onText: (chunk: string) => void,
  onStructured: (payload: StructuredBrief) => void,
  onNotice: (message: string, detail?: string, level?: "info" | "warn") => void,
) {
  if (!response.ok || !response.body) {
    throw new Error(`Narration failed (${response.status})`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      let payload: {
        type: string;
        text?: string;
        payload?: StructuredBrief;
        message?: string;
        detail?: string;
        level?: "info" | "warn";
      };
      try {
        payload = JSON.parse(line.slice(5).trim()) as typeof payload;
      } catch {
        continue;
      }
      if (payload.type === "text" && payload.text) onText(payload.text);
      if (payload.type === "structured" && payload.payload) onStructured(payload.payload);
      if (payload.type === "notice" && payload.message) {
        onNotice(payload.message, payload.detail, payload.level ?? "info");
      }
      if (payload.type === "error") {
        throw new Error(
          payload.detail ? `${payload.message || "Narration error"}: ${payload.detail}` : payload.message || "Narration error",
        );
      }
    }
  }
}

export function InsightCanvas({ specimen }: { specimen: ScanSpecimen | null }) {
  const [streamText, setStreamText] = useState("");
  const [structured, setStructured] = useState<StructuredBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; level: "info" | "warn" } | null>(null);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);

  const runBrief = useCallback(async () => {
    if (!specimen) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    setStreamText("");
    setStructured(null);
    setReply(null);
    try {
      const response = await fetch("/api/scan/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: specimen.context }),
      });
      await readSseStream(
        response,
        (chunk) => setStreamText((current) => current + chunk),
        (payload) => setStructured(payload),
        (message, detail, level) =>
          setNotice({
            message: detail ? `${message} (${detail})` : message,
            level: level ?? "info",
          }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [specimen]);

  useEffect(() => {
    void runBrief();
  }, [runBrief]);

  const sendFollowUp = async () => {
    if (!specimen || !message.trim()) return;
    setChatLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/scan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: specimen.context, message }),
      });
      let data: { text?: string; error?: string };
      try {
        data = (await response.json()) as { text?: string; error?: string };
      } catch {
        setError("Could not read response from chat.");
        return;
      }
      if (!response.ok) {
        setError(data.error || `Chat failed (${response.status})`);
        return;
      }
      setReply(data.text ?? "");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChatLoading(false);
    }
  };

  const reminderText =
    specimen && structured
      ? structured.nextChecks
          .filter((s) => !/https?:\/\//i.test(s))
          .map((s) => s.replace(/\*\*/g, ""))
          .join(" · ")
      : "";

  if (!specimen) {
    return (
      <Card className="desk-surface-raised flex min-h-[min(480px,70vh)] max-w-full min-w-0 flex-col items-center justify-center gap-3 overflow-hidden p-8 sm:min-h-[520px]">
        <p className="text-center font-display text-title">Insights</p>
        <p className="max-w-sm text-pretty text-center text-caption sm:max-w-xs">
          Select a card row to stream the AI brief, verification matrix, and follow-up chat grounded in that
          specimen&apos;s market context.
        </p>
      </Card>
    );
  }

  return (
    <Card className="desk-surface-raised flex min-h-[min(520px,72vh)] max-w-full min-w-0 flex-col overflow-hidden p-5 sm:min-h-[520px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-title">Insights</h2>
          <p className="mt-1 text-caption">
            {[getCardDisplayTitle(specimen.card), getCardDisplaySubtitle(specimen.card)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="w-full shrink-0 touch-manipulation sm:w-auto"
          onClick={() => void runBrief()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh brief"}
        </Button>
      </div>

      <div aria-live="polite" className="mt-4 min-w-0 max-w-full flex-1 space-y-5 overflow-auto pr-0.5 sm:space-y-4">
        {structured ? (
          <>
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">At a glance</h3>
              <div className="mt-2 space-y-2">
                <SpecimenMarketSummary specimen={specimen} variant="default" />
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-panel-raised/40 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-faint">Print / stamps</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-primary break-words">
                      {specimen.card.printStamps?.trim() || "—"}
                    </p>
                  </div>
                  <VerificationPill status={specimen.context.verificationStatus} />
                </div>
              </div>
            </section>
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Summary</h3>
              <p className="mt-2 text-sm leading-relaxed text-primary sm:text-xs sm:leading-6">{stripMdBold(structured.summary)}</p>
            </section>
            {structured.marketSnapshot ? (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Market snapshot</h3>
                <p className="mt-2 text-sm leading-relaxed text-primary sm:text-xs sm:leading-6">
                  {stripMdBold(structured.marketSnapshot)}
                </p>
              </section>
            ) : null}
            {structured.compAnalysis ? (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Comp analysis</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-primary sm:text-xs sm:leading-6">
                  {stripMdBold(structured.compAnalysis)}
                </p>
              </section>
            ) : null}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Verification</h3>
              <div className="mt-2 w-full max-w-full overflow-x-hidden rounded-xl border border-border-subtle">
                <table className="w-full table-fixed text-left text-xs sm:text-sm">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[28%]" />
                    <col className="w-[28%]" />
                    <col className="w-[22%]" />
                  </colgroup>
                  <thead className="bg-panel-raised text-muted">
                    <tr>
                      <th className="px-2 py-2 font-medium">Field</th>
                      <th className="px-2 py-2 font-medium">Extracted</th>
                      <th className="px-2 py-2 font-medium">Verified</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structured.verification.map((row) => (
                      <tr key={row.field} className="border-t border-border-subtle">
                        <td className="min-w-0 break-words px-2 py-2 text-primary">{row.field}</td>
                        <td className="min-w-0 break-words px-2 py-2 text-muted">{row.extracted ?? "—"}</td>
                        <td className="min-w-0 break-words px-2 py-2 text-muted">{row.verified ?? "—"}</td>
                        <td className="min-w-0 break-words px-2 py-2 text-primary">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            {structured.gradedSupply ? (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Graded supply</h3>
                <p className="mt-2 text-sm leading-relaxed text-primary sm:text-xs sm:leading-6">
                  {stripMdBold(structured.gradedSupply)}
                </p>
              </section>
            ) : null}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Valuation</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-primary sm:text-xs sm:leading-6">
                {stripMdBold(structured.valuation)}
              </p>
            </section>
            <MarketSourceHub links={specimen.context.marketSourceLinks} compact />
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Samples</h3>
              <p className="mt-1 text-[11px] text-muted">Latest rows from enrichment — follow the link for each source.</p>
              <div className="mt-2">
                <MarketEvidenceTable
                  items={
                    structured.marketEvidence.length > 0
                      ? structured.marketEvidence
                      : specimen.context.marketEvidence
                  }
                  hubLinks={specimen.context.marketSourceLinks}
                  card={specimen.card}
                  maxRows={8}
                />
              </div>
            </section>
            {reminderText ? (
              <p className="text-[11px] leading-relaxed text-muted">
                <span className="font-medium text-faint">Reminders: </span>
                {reminderText}
              </p>
            ) : null}
          </>
        ) : (
          <pre className="whitespace-pre-wrap text-base leading-relaxed text-primary sm:text-sm sm:leading-6">{streamText}</pre>
        )}
        {notice ? (
          <p
            className={
              notice.level === "warn"
                ? "text-base text-warning sm:text-sm"
                : "text-base text-muted sm:text-sm"
            }
          >
            {notice.message}
          </p>
        ) : null}
        {error ? <p className="text-base text-danger sm:text-sm">{error}</p> : null}
        {reply ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Follow-up</h3>
            <p className="mt-2 text-base leading-relaxed text-primary sm:text-sm sm:leading-6">{reply}</p>
          </section>
        ) : null}
      </div>

      <div className="mt-4 min-w-0 max-w-full border-t border-border-subtle pt-4">
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask a follow-up…"
          disabled={chatLoading}
          className="text-base sm:text-sm"
        />
        <Button className="mt-3 h-12 w-full touch-manipulation text-base sm:h-10 sm:w-auto sm:text-sm" onClick={() => void sendFollowUp()} disabled={!message.trim() || chatLoading}>
          {chatLoading ? "Sending…" : "Send follow-up"}
        </Button>
      </div>
    </Card>
  );
}
