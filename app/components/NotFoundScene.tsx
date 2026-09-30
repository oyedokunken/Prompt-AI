"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Home } from "lucide-react";
import { Logo } from "@/components/Logo";

interface Star {
  x: number;
  y: number;
  size: number;
  baseOpacity: number;
  twinkle: boolean;
  delay: number;
  duration: number;
}

// Deterministic small PRNG so this never depends on Math.random() during
// render, star positions are generated once on mount instead.
function makeStars(count: number): Star[] {
  const stars: Star[] = [];
  let seed = 1337;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * 100,
      y: rand() * 100,
      size: rand() * 1.8 + 0.6,
      baseOpacity: rand() * 0.5 + 0.25,
      twinkle: rand() > 0.65,
      delay: rand() * 6,
      duration: rand() * 3 + 3,
    });
  }
  return stars;
}

function Starfield({ animate }: { animate: boolean }) {
  const [stars, setStars] = useState<Star[] | null>(null);

  useEffect(() => {
    setStars(makeStars(90));
  }, []);

  if (!stars) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {stars.map((star, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.baseOpacity,
            animation:
              animate && star.twinkle
                ? `not-found-twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`
                : undefined,
          }}
        />
      ))}
    </div>
  );
}

function DriftingProbe({ animate }: { animate: boolean }) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ top: "28%", left: "-8%" }}
      aria-hidden="true"
      initial={{ x: 0, y: 0 }}
      animate={
        animate
          ? {
              x: ["0vw", "116vw"],
              y: [0, -18, 6, -10, 0],
            }
          : { x: "38vw", y: 0 }
      }
      transition={
        animate
          ? {
              x: { duration: 70, repeat: Infinity, ease: "linear" },
              y: { duration: 14, repeat: Infinity, ease: "easeInOut" },
            }
          : undefined
      }
    >
      <svg width="72" height="40" viewBox="0 0 72 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="36" cy="20" rx="26" ry="9" stroke="#5C5C63" strokeWidth="1.2" />
        <path d="M14 20 L4 20" stroke="#5C5C63" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M58 20 L68 20" stroke="#5C5C63" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="36" cy="20" r="4" stroke="#F2A93B" strokeWidth="1.2" />
        <path d="M26 13 L20 6" stroke="#5C5C63" strokeWidth="1" strokeLinecap="round" />
        <path d="M46 13 L52 6" stroke="#5C5C63" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </motion.div>
  );
}

export function NotFoundScene({ isAuthenticated }: { isAuthenticated: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;

  return (
    <div className="dark relative min-h-screen w-full overflow-hidden bg-base flex flex-col items-center justify-center px-4">
      <style>{`
        @keyframes not-found-twinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.9; }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 90% 60% at 50% 20%, rgba(139,124,246,0.08) 0%, transparent 60%)" }}
      />
      <Starfield animate={animate} />
      <DriftingProbe animate={animate} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        <Logo variant="mono" size={30} className="mb-8 opacity-80" />

        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-text-faint mb-4">
          Transmission status: no signal
        </p>

        <h1 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight mb-3">
          This coordinate does not exist in our system
        </h1>

        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Whatever you were looking for has drifted off the map. The link
          may be outdated, or the page was moved somewhere we have not
          charted yet.
        </p>

        <p className="font-mono text-[10px] text-text-faint tracking-wider mb-10">
          SECTOR 404 &middot; LAST KNOWN POSITION UNRESOLVED
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-accent-fill text-accent-fill-foreground text-sm font-semibold hover:bg-accent-fill/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Home size={15} />
            Return to homepage
          </Link>
          {isAuthenticated && (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-text-muted hover:text-text-primary hover:border-border/80 transition-colors focus-visible:outline-accent"
            >
              <ArrowLeft size={15} />
              Back to dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
