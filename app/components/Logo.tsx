"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "color" | "mono";
  size?: number;
  className?: string;
}

export function Logo({ variant = "color", size = 32, className }: LogoProps) {
  const accentColor = variant === "color" ? "#F2A93B" : "#5C5C63";
  const inkColor = variant === "color" ? "#EDEDEF" : "#8B8B93";
  const bgColor = variant === "color" ? "#111113" : "#111113";
  const borderColor = variant === "color" ? "#232327" : "#1A1A1D";

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
          fill={bgColor}
          stroke={borderColor}
          strokeWidth="1"
        />
        <text
          x="5"
          y="20"
          fontFamily="'Geist Mono', monospace"
          fontSize="12"
          fontWeight="600"
          fill={accentColor}
        >
          &gt;
        </text>
        <text
          x="14"
          y="20"
          fontFamily="'Geist Mono', monospace"
          fontSize="12"
          fontWeight="400"
          fill={inkColor}
        >
          _
        </text>
        <rect
          x="14"
          y="21"
          width="8"
          height="2"
          rx="1"
          fill={accentColor}
          opacity="0.7"
        />
      </svg>
      <span
        style={{
          fontFamily: "var(--font-geist)",
          fontSize: `${Math.round(size * 0.5)}px`,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: inkColor,
          lineHeight: 1,
        }}
      >
        Prompt
        <span style={{ color: accentColor }}>AI</span>
      </span>
    </span>
  );
}
