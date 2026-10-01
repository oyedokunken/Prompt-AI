"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "color" | "mono";
  size?: number;
  className?: string;
  // Just the badge, without the wordmark, for narrow spaces such as a collapsed sidebar.
  iconOnly?: boolean;
}

// The icon chip is a fixed brand badge, a small dark square with a glyph
// inside, the same way most logo marks keep a constant badge color rather
// than inverting with the page theme. The wordmark next to it is not part
// of that fixed badge, so it uses the theme's ink tokens and must stay
// legible against whichever background it is placed on.
export function Logo({ variant = "color", size = 32, className, iconOnly = false }: LogoProps) {
  const isMono = variant === "mono";
  const glyphColor = isMono ? "#8B8B93" : "#F2A93B";

  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="Prompt AI"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-hidden="true"
      >
        <rect
          width="32"
          height="32"
          rx="8"
          fill="#111113"
          stroke="#232327"
          strokeWidth="1"
        />
        <text
          x="5"
          y="20"
          fontFamily="'Geist Mono', monospace"
          fontSize="12"
          fontWeight="600"
          fill={glyphColor}
        >
          &gt;
        </text>
        <text
          x="14"
          y="20"
          fontFamily="'Geist Mono', monospace"
          fontSize="12"
          fontWeight="400"
          fill="#EDEDEF"
        >
          _
        </text>
        <rect
          x="14"
          y="21"
          width="8"
          height="2"
          rx="1"
          fill={glyphColor}
          opacity="0.7"
        />
      </svg>
      {!iconOnly && (
      <span
        style={{
          fontFamily: "var(--font-geist)",
          fontSize: `${Math.round(size * 0.5)}px`,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
        className={isMono ? "text-text-muted" : "text-text-primary"}
      >
        Prompt
        <span className={isMono ? "text-text-muted" : "text-accent"}>AI</span>
      </span>
      )}
    </span>
  );
}
