"use client";

import { useEffect, useState } from "react";

const VIEWPORT_MOBILE_MQ = "(max-width: 1023px)";

/** True when viewport is phone/tablet (< lg). */
export function useViewportMobile(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(VIEWPORT_MOBILE_MQ);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return mobile;
}
