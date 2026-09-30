"use client";

import React from "react";
import { motion } from "framer-motion";
import { Container } from "@/components/Container";

const BRANDS = [
  {
    name: "Claude",
    slug: "anthropic",
    hex: "D97706",
    path: "M12.0002 0C5.37276 0 0 5.37276 0 12.0002C0 18.6272 5.37276 24 12.0002 24C18.6272 24 24 18.6272 24 12.0002C24 5.37276 18.6272 0 12.0002 0ZM17.1582 16.8752H14.9922L12.0012 10.9062L9.00915 16.8752H6.84315L11.0952 8.78715C11.3162 8.35215 11.6422 8.12415 12.0012 8.12415C12.3612 8.12415 12.6862 8.35215 12.9062 8.78715L17.1582 16.8752Z",
  },
  {
    name: "OpenAI",
    slug: "openai",
    hex: "412991",
    path: "M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z",
  },
  {
    name: "Gemini",
    slug: "googlegemini",
    hex: "8E75B2",
    path: "M11.9995 0C8.6815 6.617 6.617 8.682 0 11.9995c6.617 3.318 8.682 5.382 11.9995 12.0005C15.318 17.382 17.382 15.318 24 12.0005 17.382 8.682 15.318 6.617 11.9995 0z",
  },
  {
    name: "Mistral",
    slug: "mistral",
    hex: "FF7000",
    path: "M0 0h4v4H0zm6 0h4v4H6zm6 0h4v4h-4zm6 0h4v4h-4zM0 6h4v4H0zm12 0h4v4h-4zm6 0h4v4h-4zM0 12h4v4H0zm6 0h4v4H6zm6 0h4v4h-4zm6 0h4v4h-4zM0 18h4v4H0zm12 0h4v4h-4zm6 0h4v4h-4z",
  },
  {
    name: "Meta",
    slug: "meta",
    hex: "0467DF",
    path: "M6.915 4.03c-1.968 2.612-3.57 5.55-4.304 7.935C2.10 13.514 2 14.33 2 15.12c0 .467.035.924.104 1.37.314 2.043 1.394 3.72 3.05 4.715 1.025.622 2.197.932 3.38.932 1.72 0 3.39-.62 4.76-1.786C14.73 19.19 16 17.11 16 14.88c0-1.17-.335-2.367-1.045-3.57-.72-1.22-1.78-2.39-3.237-3.55C10.3 6.67 9.16 5.95 8.09 5.355c-.37-.208-.72-.405-1.05-.593-.11-.06-.21-.12-.32-.178C6.78 4.44 6.85 4.23 6.915 4.03m10.154 0c.066.2.135.41.196.555-.11.058-.21.118-.32.178-.33.188-.68.385-1.05.593-1.07.595-2.21 1.315-3.628 2.405-1.457 1.16-2.517 2.33-3.237 3.55-.71 1.203-1.045 2.4-1.045 3.57 0 2.23 1.27 4.31 3.705 5.472 1.37 1.166 3.04 1.786 4.76 1.786 1.183 0 2.355-.31 3.38-.932 1.656-.995 2.736-2.672 3.05-4.715.07-.446.104-.903.104-1.37 0-.79-.1-1.606-.61-3.155-.734-2.386-2.336-5.323-4.304-7.935M12 8.89c.967.63 1.875 1.387 2.688 2.184 1.107 1.08 1.995 2.22 2.552 3.285.542 1.04.76 1.987.76 2.82 0 1.424-.706 2.722-1.89 3.633C14.914 21.57 13.49 22 12 22c-1.49 0-2.914-.43-4.11-1.188C6.706 19.9 6 18.604 6 17.18c0-.833.218-1.78.76-2.82.557-1.065 1.445-2.205 2.552-3.285C10.124 10.277 11.033 9.52 12 8.89",
  },
  {
    name: "Llama",
    slug: "meta",
    hex: "0467DF",
    path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z",
  },
  {
    name: "Perplexity",
    slug: "perplexity",
    hex: "1FB8CD",
    path: "M21.418 8.574l-2.84-2.84V1.25h-1.5v3.19l-5.078 5.075-5.077-5.076V1.25h-1.5v4.484l-2.84 2.84H1.25v1.5h1.817l-1.567 1.565v4.84l2.84 2.84v3.661h1.5v-2.35l5.077 5.076v2.289h1.5v-2.29l5.078-5.075v2.35h1.5v-3.661l2.84-2.84v-4.84l-1.568-1.566h1.818v-1.5zM4.84 9.634l-.09.09H3.5l.75-.75.59.66zm2.16-.535L12 4.098l5 5.001v5.802l-5 5.001-5-5V9.1zm12.91 1.36-.09-.09.59-.66.75.75h-1.25zm-7.66 9.892l-.25-.25v-1.19l5.078-5.076.001 1.567-4.829 4.949zm5.082-13.81L12.25 2.063v-1.19l.25-.25 5.082 5.083-1.333.165z",
  },
  {
    name: "Cohere",
    slug: "cohere",
    hex: "39594D",
    path: "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 1.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm2.5 4.5h-5A2.5 2.5 0 0 0 7 10.5v3A2.5 2.5 0 0 0 9.5 16h5a2.5 2.5 0 0 0 2.5-2.5v-3A2.5 2.5 0 0 0 14.5 8z",
  },
];

const LOGOS_DOUBLED = [...BRANDS, ...BRANDS];

export function Integrations() {
  return (
    <section
      id="integrations"
      className="py-16 lg:py-24 border-t border-border-subtle overflow-hidden"
    >
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">
            Compatible
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight">
            Works with the models you already use
          </h2>
        </motion.div>
      </Container>

      <div className="relative">
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10"
          style={{
            background:
              "linear-gradient(to right, rgb(var(--color-bg)), transparent)",
          }}
        />
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10"
          style={{
            background:
              "linear-gradient(to left, rgb(var(--color-bg)), transparent)",
          }}
        />

        <div className="flex animate-marquee hover:[animation-play-state:paused]">
          {LOGOS_DOUBLED.map((brand, i) => (
            <div
              key={`${brand.name}-${i}`}
              className="flex flex-col items-center justify-center gap-2 mx-8 shrink-0 group"
              title={brand.name}
            >
              <div className="w-12 h-12 flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  width={32}
                  height={32}
                  fill="currentColor"
                  className="text-text-faint group-hover:text-text-primary transition-colors duration-200"
                  style={{
                    "--brand-color": `#${brand.hex}`,
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    (e.currentTarget as SVGElement).style.color = `#${brand.hex}`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as SVGElement).style.color = "";
                  }}
                  aria-label={brand.name}
                >
                  <path d={brand.path} />
                </svg>
              </div>
              <span className="font-mono text-xs text-text-faint group-hover:text-text-muted transition-colors">
                {brand.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
