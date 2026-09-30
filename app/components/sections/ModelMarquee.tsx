"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Container } from "@/components/Container";

interface ModelCard {
  name: string;
  provider: string;
  description: string;
  iconPath: string;
  iconHex: string;
}

const CLAUDE: ModelCard = {
  name: "Claude 3.5 Sonnet",
  provider: "Anthropic",
  description:
    "Uses XML tag structure for roles and delimiters. Prompt AI applies <role>, <context>, and <output> wrappers to match Claude's preferred parsing format.",
  iconHex: "D97706",
  iconPath:
    "M12.0002 0C5.37276 0 0 5.37276 0 12.0002C0 18.6272 5.37276 24 12.0002 24C18.6272 24 24 18.6272 24 12.0002C24 5.37276 18.6272 0 12.0002 0ZM17.1582 16.8752H14.9922L12.0012 10.9062L9.00915 16.8752H6.84315L11.0952 8.78715C11.3162 8.35215 11.6422 8.12415 12.0012 8.12415C12.3612 8.12415 12.6862 8.35215 12.9062 8.78715L17.1582 16.8752Z",
};

const ROW_ONE: ModelCard[] = [
  CLAUDE,
  {
    name: "GPT-4o",
    provider: "OpenAI",
    description:
      "Formats instructions as a system message with a structured user turn. Prompt AI separates role context into the system prompt and task into the user message.",
    iconHex: "412991",
    iconPath:
      "M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z",
  },
  {
    name: "Gemini 1.5 Pro",
    provider: "Google",
    description:
      "Performs well with extended context blocks. Prompt AI adjusts token budget assumptions and places constraints earlier in the instruction set for Gemini targets.",
    iconHex: "4285F4",
    iconPath:
      "M11.9995 0C8.6815 6.617 6.617 8.682 0 11.9995c6.617 3.318 8.682 5.382 11.9995 12.0005C15.318 17.382 17.382 15.318 24 12.0005 17.382 8.682 15.318 6.617 11.9995 0z",
  },
  {
    name: "Mistral Large",
    provider: "Mistral AI",
    description:
      "Uses ChatML-compatible formatting. Prompt AI applies instruction-tuned conventions and avoids markdown-heavy structures that reduce Mistral performance.",
    iconHex: "FF7000",
    iconPath:
      "M0 0h4v4H0zm6 0h4v4H6zm6 0h4v4h-4zm6 0h4v4h-4zM0 6h4v4H0zm12 0h4v4h-4zm6 0h4v4h-4zM0 12h4v4H0zm6 0h4v4H6zm6 0h4v4h-4zm6 0h4v4h-4zM0 18h4v4H0zm12 0h4v4h-4zm6 0h4v4h-4z",
  },
  {
    name: "DeepSeek Coder V2",
    provider: "DeepSeek",
    description:
      "Optimized for code generation with instruction-tuned fine-tuning. Prompt AI structures task blocks with explicit language version and file-scope constraints.",
    iconHex: "4D6BFE",
    iconPath:
      "M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 14.93V15a1 1 0 0 0-2 0v1.93A8.001 8.001 0 0 1 4.07 9H6a1 1 0 0 0 0-2H4.07A8.001 8.001 0 0 1 11 3.07V5a1 1 0 0 0 2 0V3.07A8.001 8.001 0 0 1 19.93 9H18a1 1 0 0 0 0 2h1.93A8.001 8.001 0 0 1 13 16.93z",
  },
  {
    name: "Mixtral 8x7B",
    provider: "Mistral AI",
    description:
      "MoE architecture with strong multi-task performance. Prompt AI targets Mixtral with concise, task-scoped prompts to minimize redundant expert activation.",
    iconHex: "FF7000",
    iconPath:
      "M0 0h4v4H0zm6 0h4v4H6zm6 0h4v4h-4zm6 0h4v4h-4zM0 6h4v4H0zm12 0h4v4h-4zm6 0h4v4h-4zM0 12h4v4H0zm6 0h4v4H6zm6 0h4v4h-4zm6 0h4v4h-4zM0 18h4v4H0zm12 0h4v4h-4zm6 0h4v4h-4z",
  },
  {
    name: "Perplexity",
    provider: "Perplexity AI",
    description:
      "Search-augmented reasoning model. Prompt AI structures prompts to leverage Perplexity's retrieval capabilities with targeted source and citation constraints.",
    iconHex: "1FB8CD",
    iconPath:
      "M21.418 8.574l-2.84-2.84V1.25h-1.5v3.19l-5.078 5.075-5.077-5.076V1.25h-1.5v4.484l-2.84 2.84H1.25v1.5h1.817l-1.567 1.565v4.84l2.84 2.84v3.661h1.5v-2.35l5.077 5.076v2.289h1.5v-2.29l5.078-5.075v2.35h1.5v-3.661l2.84-2.84v-4.84l-1.568-1.566h1.818v-1.5zM4.84 9.634l-.09.09H3.5l.75-.75.59.66zm2.16-.535L12 4.098l5 5.001v5.802l-5 5.001-5-5V9.1zm12.91 1.36-.09-.09.59-.66.75.75h-1.25zm-7.66 9.892l-.25-.25v-1.19l5.078-5.076.001 1.567-4.829 4.949zm5.082-13.81L12.25 2.063v-1.19l.25-.25 5.082 5.083-1.333.165z",
  },
  {
    name: "Grok 2",
    provider: "xAI",
    description:
      "Real-time knowledge model with strong reasoning. Prompt AI applies concise role-scoped framing and avoids redundant context blocks that reduce Grok's response precision.",
    iconHex: "EDEDEF",
    iconPath:
      "M1.5 2h4l5.5 8L16.5 2h4L12 14.5 20.5 22h-4L12 17l-4.5 5H3.5L12 14.5z",
  },
  {
    name: "o1-mini",
    provider: "OpenAI",
    description:
      "Compact reasoning model optimised for STEM and code. Prompt AI keeps prompts minimal and task-scoped to stay within o1-mini's optimal reasoning window.",
    iconHex: "412991",
    iconPath:
      "M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073z",
  },
  {
    name: "Claude 3 Haiku",
    provider: "Anthropic",
    description:
      "Fast, cost-efficient Claude model. Prompt AI trims context to core role and task blocks, eliminating decorators that add latency without improving Haiku's output.",
    iconHex: "D97706",
    iconPath:
      "M12.0002 0C5.37276 0 0 5.37276 0 12.0002C0 18.6272 5.37276 24 12.0002 24C18.6272 24 24 18.6272 24 12.0002C24 5.37276 18.6272 0 12.0002 0ZM17.1582 16.8752H14.9922L12.0012 10.9062L9.00915 16.8752H6.84315L11.0952 8.78715C11.3162 8.35215 11.6422 8.12415 12.0012 8.12415C12.3612 8.12415 12.6862 8.35215 12.9062 8.78715L17.1582 16.8752Z",
  },
];

const ROW_TWO: ModelCard[] = [
  {
    name: "Llama 3.1 70B",
    provider: "Meta",
    description:
      "Applies prompt templates consistent with llama.cpp and vLLM serving format. Prompt AI avoids token-heavy decorators that bloat context on local inference setups.",
    iconHex: "0467DF",
    iconPath:
      "M6.915 4.03c-1.968 2.612-3.57 5.55-4.304 7.935C2.1 13.514 2 14.33 2 15.12c0 .467.035.924.104 1.37.314 2.043 1.394 3.72 3.05 4.715 1.025.622 2.197.932 3.38.932 1.72 0 3.39-.62 4.76-1.786C14.73 19.19 16 17.11 16 14.88c0-1.17-.335-2.367-1.045-3.57-.72-1.22-1.78-2.39-3.237-3.55C10.3 6.67 9.16 5.95 8.09 5.355c-.37-.208-.72-.405-1.05-.593-.11-.06-.21-.12-.32-.178C6.78 4.44 6.85 4.23 6.915 4.03z",
  },
  {
    name: "Qwen 2.5 Coder",
    provider: "Alibaba",
    description:
      "Targets code-specific instruction tuning. Prompt AI emphasizes language version, runtime, and output format constraints when building prompts for this model.",
    iconHex: "FF6A00",
    iconPath:
      "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-.39 4.5h.78l3.12 7.5H14.1l-.72-1.8H10.62L9.9 12H8.49L11.61 4.5zm-.99 4.5l-1.08 2.7h2.76l-1.08-2.7h-.6zM5.25 9h1.5v6h-1.5V9zm12 0h1.5v6H17.25V9z",
  },
  {
    name: "Command R+",
    provider: "Cohere",
    description:
      "Enterprise retrieval with citation output. Prompt AI formats grounding instructions and explicit citation requirements to match Command R+'s preferred structure.",
    iconHex: "39594D",
    iconPath:
      "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 1.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm2.5 4.5h-5A2.5 2.5 0 0 0 7 10.5v3A2.5 2.5 0 0 0 9.5 16h5a2.5 2.5 0 0 0 2.5-2.5v-3A2.5 2.5 0 0 0 14.5 8z",
  },
  {
    name: "Phi-3 Medium",
    provider: "Microsoft",
    description:
      "Compact SLM with strong reasoning on structured tasks. Prompt AI keeps prompts tight and explicit to stay within Phi-3's optimal context range.",
    iconHex: "00A4EF",
    iconPath:
      "M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z",
  },
  CLAUDE,
  {
    name: "GPT-4o mini",
    provider: "OpenAI",
    description:
      "Cost-efficient variant with strong instruction following. Prompt AI trims context blocks to stay under budget while preserving task and constraint fidelity.",
    iconHex: "412991",
    iconPath:
      "M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z",
  },
  {
    name: "Gemini 2.0 Flash",
    provider: "Google",
    description:
      "Fast multimodal model with improved instruction following. Prompt AI applies shortened context with frontloaded constraints optimized for Flash's latency target.",
    iconHex: "4285F4",
    iconPath:
      "M11.9995 0C8.6815 6.617 6.617 8.682 0 11.9995c6.617 3.318 8.682 5.382 11.9995 12.0005C15.318 17.382 17.382 15.318 24 12.0005 17.382 8.682 15.318 6.617 11.9995 0z",
  },
  {
    name: "Codestral",
    provider: "Mistral AI",
    description:
      "Code-specialist model from Mistral with 80k context. Prompt AI structures fill-in-the-middle and instruction blocks explicitly to match Codestral's training format.",
    iconHex: "FF7000",
    iconPath:
      "M0 0h4v4H0zm6 0h4v4H6zm6 0h4v4h-4zm6 0h4v4h-4zM0 6h4v4H0zm12 0h4v4h-4zm6 0h4v4h-4zM0 12h4v4H0zm6 0h4v4H6zm6 0h4v4h-4zm6 0h4v4h-4zM0 18h4v4H0zm12 0h4v4h-4zm6 0h4v4h-4z",
  },
  {
    name: "Llama 3.2 90B",
    provider: "Meta",
    description:
      "Meta's largest openly available model with vision capabilities. Prompt AI targets Llama 3.2 with BOS-aligned instruction blocks and avoids ChatML-specific formatting.",
    iconHex: "0467DF",
    iconPath:
      "M6.915 4.03c-1.968 2.612-3.57 5.55-4.304 7.935C2.1 13.514 2 14.33 2 15.12c0 .467.035.924.104 1.37.314 2.043 1.394 3.72 3.05 4.715 1.025.622 2.197.932 3.38.932 1.72 0 3.39-.62 4.76-1.786C14.73 19.19 16 17.11 16 14.88c0-1.17-.335-2.367-1.045-3.57-.72-1.22-1.78-2.39-3.237-3.55C10.3 6.67 9.16 5.95 8.09 5.355c-.37-.208-.72-.405-1.05-.593-.11-.06-.21-.12-.32-.178C6.78 4.44 6.85 4.23 6.915 4.03z",
  },
  {
    name: "o3-mini",
    provider: "OpenAI",
    description:
      "High-efficiency reasoning model with adjustable effort levels. Prompt AI structures constraints and chain-of-thought scaffolding to maximise o3-mini's reasoning depth.",
    iconHex: "412991",
    iconPath:
      "M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073z",
  },
];

function ModelCardEl({ card, hovered }: { card: ModelCard; hovered: boolean }) {
  const isLive = card.name === "GPT-4o";
  return (
    <div
      className="shrink-0 w-[280px] rounded-xl border bg-surface p-4 flex flex-col gap-3 mx-3 transition-all duration-200"
      style={{
        borderColor: hovered ? "rgba(242,169,59,0.3)" : "rgb(var(--color-border))",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 shrink-0 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="currentColor"
              style={{
                color: hovered ? `#${card.iconHex}` : "rgb(var(--color-ink-faint))",
                transition: "color 0.2s ease",
              }}
              aria-label={card.provider}
            >
              <path d={card.iconPath} />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-text-primary leading-none">
              {card.name}
            </p>
            <p className="text-xs text-text-faint font-mono mt-0.5">
              {card.provider}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 text-xs font-mono px-1.5 py-0.5 rounded border leading-none ${
            isLive ? "border-accent/30 text-accent bg-accent/5" : "border-border text-text-faint"
          }`}
        >
          {isLive ? "Live" : "Coming soon"}
        </span>
      </div>
      <p className="text-xs text-text-muted leading-relaxed line-clamp-3">
        {card.description}
      </p>
    </div>
  );
}

function MarqueeRow({
  cards,
  reverse,
}: {
  cards: ModelCard[];
  reverse?: boolean;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const doubled = [...cards, ...cards];

  return (
    <div
      className="flex overflow-hidden"
      style={{ maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)" }}
    >
      <div
        className={`flex ${reverse ? "animate-marquee-reverse" : "animate-marquee"} hover:[animation-play-state:paused]`}
      >
        {doubled.map((card, i) => (
          <div
            key={`${card.name}-${i}`}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <ModelCardEl card={card} hovered={hoveredIdx === i} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ModelMarquee() {
  return (
    <section id="models" className="py-16 lg:py-24 border-t border-border-subtle overflow-hidden">
      <Container className="mb-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">
            Targeting
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight max-w-2xl">
            Built for the models you're actually using
          </h2>
          <p className="text-text-muted text-base mt-4 leading-relaxed max-w-2xl">
            Each model has formatting conventions, instruction preferences, and
            context window constraints. Prompt AI accounts for all of them when
            you pick a target.
          </p>
        </motion.div>
      </Container>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="flex flex-col gap-4"
      >
        <MarqueeRow cards={ROW_ONE} />
        <MarqueeRow cards={ROW_TWO} reverse />
      </motion.div>
    </section>
  );
}
