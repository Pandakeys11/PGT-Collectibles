/** PGT Tools partner — retro emulator arcade (wallet-gated on PGTools). */
export const PGT_ARCADE_URL = "https://www.pgtools.tech/app/arcade";

/** Permissions for in-app iframe (games, wallet popups, fullscreen). */
export const PGT_ARCADE_IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gamepad; gyroscope; picture-in-picture; web-share";

export const PGT_ARCADE_PARTNER = {
  id: "pgt-arcade" as const,
  label: "PGT Arcade",
  tagline: "Partner emulator hub",
  homeUrl: "https://www.pgtools.tech",
  arcadeUrl: PGT_ARCADE_URL,
  features: [
    "Classic console & handheld emulators in one hub",
    "Wallet sign-in on PGTools unlocks your game library",
    "Play inside Liquid Scan — same PGTools arcade, embedded below",
  ],
};
