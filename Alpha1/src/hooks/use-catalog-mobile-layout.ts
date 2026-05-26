"use client";

import { useEffect, useState } from "react";

const CATALOG_MOBILE_MQ = "(max-width: 1023px)";

/** Stepped sets → cards → detail flow for catalog embedded in Liquid Scan on phones/tablets. */
export function useCatalogMobileLayout(embedded: boolean): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!embedded) {
      setIsMobile(false);
      return;
    }
    const mq = window.matchMedia(CATALOG_MOBILE_MQ);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [embedded]);

  return embedded && isMobile;
}
