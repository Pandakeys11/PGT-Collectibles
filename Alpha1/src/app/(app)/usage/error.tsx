"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function UsageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-10">
      <Card className="desk-surface-raised p-6">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-300" />
          <div>
            <h1 className="font-display text-lg font-semibold text-primary">Usage unavailable</h1>
            <p className="mt-2 text-sm text-muted">
              {error.message ||
                "We could not load your scan usage. Apply the latest Supabase migrations if this persists."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="scan" size="sm" onClick={() => reset()}>
                Try again
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/scanner">Back to scanner</Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
