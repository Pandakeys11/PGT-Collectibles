import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/scanner(.*)",
  "/profile(.*)",
  "/saved(.*)",
  "/usage(.*)",
  "/admin(.*)",
  "/api/account(.*)",
  "/api/saved(.*)",
  "/api/vision/extract(.*)",
  "/api/scan/chat(.*)",
  "/api/scan/enrich(.*)",
  "/api/scan/narrate(.*)",
  "/api/companion(.*)",
  "/api/billing/checkout(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
