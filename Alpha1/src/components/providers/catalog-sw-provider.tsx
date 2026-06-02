"use client";

import { useEffect } from "react";

const SW_PATH = "/sw-catalog.js";

export function registerCatalogServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PUBLIC_CATALOG_SW === "0") return;

  void navigator.serviceWorker
    .register(SW_PATH, { scope: "/" })
    .then((registration) => {
      registration.update().catch(() => {});
    })
    .catch(() => {
      /* Non-fatal — app works without offline cache */
    });
}

export function CatalogSwProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerCatalogServiceWorker();
  }, []);

  return children;
}
