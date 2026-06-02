import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--bg-canvas) / <alpha-value>)",
        panel: "rgb(var(--bg-panel) / <alpha-value>)",
        "panel-raised": "rgb(var(--bg-panel-raised) / <alpha-value>)",
        subtle: "rgb(var(--bg-subtle) / <alpha-value>)",
        overlay: "rgb(var(--bg-overlay) / <alpha-value>)",
        primary: "rgb(var(--text-primary) / <alpha-value>)",
        secondary: "rgb(var(--text-secondary) / <alpha-value>)",
        muted: "rgb(var(--text-muted) / <alpha-value>)",
        faint: "rgb(var(--text-faint) / <alpha-value>)",
        inverse: "rgb(var(--text-inverse) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-strong": "rgb(var(--accent-strong) / <alpha-value>)",
        "accent-glow": "rgb(var(--accent-glow) / <alpha-value>)",
        "accent-tertiary": "rgb(var(--accent-tertiary) / <alpha-value>)",
        brand: {
          cyan: "rgb(var(--brand-cyan) / <alpha-value>)",
          "cyan-dim": "rgb(var(--brand-cyan-dim) / <alpha-value>)",
          "cyan-bright": "rgb(var(--brand-cyan-bright) / <alpha-value>)",
          gold: "rgb(var(--brand-gold) / <alpha-value>)",
          violet: "rgb(var(--brand-violet) / <alpha-value>)",
          mint: "rgb(var(--brand-mint) / <alpha-value>)",
          rose: "rgb(var(--brand-rose) / <alpha-value>)",
          sky: "rgb(var(--brand-sky) / <alpha-value>)",
          amber: "rgb(var(--brand-amber) / <alpha-value>)",
        },
        lane: {
          scan: "rgb(var(--lane-scan) / <alpha-value>)",
          market: "rgb(var(--lane-market) / <alpha-value>)",
          fmv: "rgb(var(--lane-fmv) / <alpha-value>)",
          ai: "rgb(var(--lane-ai) / <alpha-value>)",
        },
        holo: {
          a: "rgb(var(--holo-a) / <alpha-value>)",
          b: "rgb(var(--holo-b) / <alpha-value>)",
          c: "rgb(var(--holo-c) / <alpha-value>)",
        },
        "border-accent": "rgb(var(--border-accent))",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        energy: {
          fire: {
            1: "rgb(var(--energy-fire-1) / <alpha-value>)",
            2: "rgb(var(--energy-fire-2) / <alpha-value>)",
            3: "rgb(var(--energy-fire-3) / <alpha-value>)",
            glow: "rgb(var(--energy-fire-glow) / <alpha-value>)",
          },
          water: {
            1: "rgb(var(--energy-water-1) / <alpha-value>)",
            2: "rgb(var(--energy-water-2) / <alpha-value>)",
            3: "rgb(var(--energy-water-3) / <alpha-value>)",
            glow: "rgb(var(--energy-water-glow) / <alpha-value>)",
          },
          electric: {
            1: "rgb(var(--energy-electric-1) / <alpha-value>)",
            2: "rgb(var(--energy-electric-2) / <alpha-value>)",
            3: "rgb(var(--energy-electric-3) / <alpha-value>)",
            glow: "rgb(var(--energy-electric-glow) / <alpha-value>)",
          },
          grass: {
            1: "rgb(var(--energy-grass-1) / <alpha-value>)",
            2: "rgb(var(--energy-grass-2) / <alpha-value>)",
            3: "rgb(var(--energy-grass-3) / <alpha-value>)",
            glow: "rgb(var(--energy-grass-glow) / <alpha-value>)",
          },
          psychic: {
            1: "rgb(var(--energy-psychic-1) / <alpha-value>)",
            2: "rgb(var(--energy-psychic-2) / <alpha-value>)",
            3: "rgb(var(--energy-psychic-3) / <alpha-value>)",
            glow: "rgb(var(--energy-psychic-glow) / <alpha-value>)",
          },
          dark: {
            1: "rgb(var(--energy-dark-1) / <alpha-value>)",
            2: "rgb(var(--energy-dark-2) / <alpha-value>)",
            3: "rgb(var(--energy-dark-3) / <alpha-value>)",
            glow: "rgb(var(--energy-dark-glow) / <alpha-value>)",
          },
          metal: {
            1: "rgb(var(--energy-metal-1) / <alpha-value>)",
            2: "rgb(var(--energy-metal-2) / <alpha-value>)",
            3: "rgb(var(--energy-metal-3) / <alpha-value>)",
            glow: "rgb(var(--energy-metal-glow) / <alpha-value>)",
          },
          fighting: {
            1: "rgb(var(--energy-fighting-1) / <alpha-value>)",
            2: "rgb(var(--energy-fighting-2) / <alpha-value>)",
            3: "rgb(var(--energy-fighting-3) / <alpha-value>)",
            glow: "rgb(var(--energy-fighting-glow) / <alpha-value>)",
          },
          fairy: {
            1: "rgb(var(--energy-fairy-1) / <alpha-value>)",
            2: "rgb(var(--energy-fairy-2) / <alpha-value>)",
            3: "rgb(var(--energy-fairy-3) / <alpha-value>)",
            glow: "rgb(var(--energy-fairy-glow) / <alpha-value>)",
          },
          dragon: {
            1: "rgb(var(--energy-dragon-1) / <alpha-value>)",
            2: "rgb(var(--energy-dragon-2) / <alpha-value>)",
            3: "rgb(var(--energy-dragon-3) / <alpha-value>)",
            4: "rgb(var(--energy-dragon-4) / <alpha-value>)",
            glow: "rgb(var(--energy-dragon-glow) / <alpha-value>)",
          },
        },
        "border-subtle": "rgb(var(--border-subtle))",
        "border-strong": "rgb(var(--border-strong))",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        display: "-0.03em",
        title: "-0.02em",
        label: "0.08em",
      },
    },
  },
  plugins: [],
};

export default config;
