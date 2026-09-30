import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "rgb(var(--color-bg) / <alpha-value>)",
        surface: "rgb(var(--color-bg-surface) / <alpha-value>)",
        raised: "rgb(var(--color-bg-raised) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        "border-subtle": "rgb(var(--color-border-subtle) / <alpha-value>)",
        "text-primary": "rgb(var(--color-ink) / <alpha-value>)",
        "text-muted": "rgb(var(--color-ink-muted) / <alpha-value>)",
        "text-faint": "rgb(var(--color-ink-faint) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        "accent-fill": "rgb(var(--color-accent-fill) / <alpha-value>)",
        "accent-fill-foreground": "rgb(var(--color-accent-fill-foreground) / <alpha-value>)",
        signal: "rgb(var(--color-signal) / <alpha-value>)",
        "signal-fill": "rgb(var(--color-signal-fill) / <alpha-value>)",
        "signal-fill-foreground": "rgb(var(--color-signal-fill-foreground) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "marquee-reverse": {
          "0%": { transform: "translateX(-50%)" },
          "100%": { transform: "translateX(0%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        marquee: "marquee 36s linear infinite",
        "marquee-reverse": "marquee-reverse 36s linear infinite",
        float: "float 5s ease-in-out infinite",
        blink: "blink 1s step-end infinite",
        "fade-in": "fade-in 0.5s ease forwards",
      },
    },
  },
  plugins: [],
};

export default config;
