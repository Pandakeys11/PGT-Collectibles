import { DESK_UI_BOOT_SCRIPT } from "@/lib/desk-ui-boot";
import { DEFAULT_THEME_ID, THEME_IDS, THEME_STORAGE_KEY } from "@/lib/themes";

/**
 * Runs in <head> before paint so `data-theme` + `data-ui` match storage and avoid a flash.
 */
export const THEME_BOOT_SCRIPT = `
(function(){
  ${DESK_UI_BOOT_SCRIPT}
  try {
    var k = ${JSON.stringify(THEME_STORAGE_KEY)};
    var allowed = ${JSON.stringify([...THEME_IDS])};
    var d = document.documentElement;
    var t = localStorage.getItem(k);
    if (t && allowed.indexOf(t) !== -1) {
      d.setAttribute("data-theme", t);
    } else {
      d.setAttribute("data-theme", ${JSON.stringify(DEFAULT_THEME_ID)});
    }
  } catch (e) {
    document.documentElement.setAttribute("data-theme", ${JSON.stringify(DEFAULT_THEME_ID)});
  }
})();
`.trim();
