import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl font-semibold text-primary">Page not found</h1>
      <p className="max-w-md text-sm text-muted">
        That route does not exist. Head back to Liquid Scan or the home page.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/liquid-scan"
          className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20"
        >
          PGT Liquid Scan
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-muted hover:border-white/20 hover:text-primary"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
