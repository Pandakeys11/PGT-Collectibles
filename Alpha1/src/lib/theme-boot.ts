import { DESK_UI_BOOT_SCRIPT } from "@/lib/desk-ui-boot";
import { DEFAULT_THEME_ID, THEME_STORAGE_KEY } from "@/lib/themes";

/**
 * Runs in <head> before paint — locks default theme and clears legacy multi-theme storage.
 */
export const THEME_BOOT_SCRIPT = `
(function(){
  ${DESK_UI_BOOT_SCRIPT}
  try {
    localStorage.removeItem(${JSON.stringify(THEME_STORAGE_KEY)});
  } catch (e) {}
  document.documentElement.setAttribute("data-theme", ${JSON.stringify(DEFAULT_THEME_ID)});
})();
`.trim();
