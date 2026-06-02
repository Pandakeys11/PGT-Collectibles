import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  isLegacyScannerRedirectDisabled,
  LEGACY_SCANNER_GONE_MESSAGE,
} from "@/lib/legacy-scanner";

function isLegacyScannerRequestPath(pathname: string): boolean {
  return pathname === "/scanner" || pathname.startsWith("/scanner/");
}

const isProtectedRoute = createRouteMatcher([
  "/scanner",
  "/liquid-scan",
  "/liquid-scan/(.*)",
  "/market/pokemon(.*)",
  "/profile(.*)",
  "/saved(.*)",
  "/scan-vault(.*)",
  "/usage(.*)",
  "/admin(.*)",
  "/api/market/intel(.*)",
  "/api/market/live-ticker(.*)",
  "/api/catalog/set-insight(.*)",
  "/api/catalog/binder-tracker(.*)",
  "/api/account(.*)",
  "/api/saved(.*)",
  "/api/scan-vault(.*)",
  "/api/vision/extract(.*)",
  "/api/scan/liquid-chat(.*)",
  "/api/scan/enrich(.*)",
  "/api/scan/registry(.*)",
  "/api/scan/market-history(.*)",
  "/api/companion(.*)",
  "/api/billing/checkout(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (
    isLegacyScannerRedirectDisabled() &&
    isLegacyScannerRequestPath(request.nextUrl.pathname)
  ) {
    return new NextResponse(LEGACY_SCANNER_GONE_MESSAGE, {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (isProtectedRoute(request)) {
    const bypassToken = process.env.DEV_VISION_BYPASS_TOKEN?.trim();
    const bypassHeader = request.headers.get("x-pgt-dev-bypass")?.trim();
    const canBypass =
      process.env.NODE_ENV !== "production" &&
      bypassToken &&
      bypassHeader &&
      bypassHeader === bypassToken;
    if (!canBypass) {
      await auth.protect();
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
