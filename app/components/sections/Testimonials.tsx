"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/components/Container";

interface Testimonial {
  id: number;
  quote: string;
  name: string;
  role: string;
  img: number;
}

const ROW_ONE: Testimonial[] = [
  {
    id: 0,
    quote:
      "I type a sentence and get a fully structured prompt back. The inferred stack context is accurate enough that I almost never have to correct it.",
    name: "Dara Owusu",
    role: "Staff Engineer",
    img: 11,
  },
  {
    id: 1,
    quote:
      "The completeness score is the part I use most. It tells me exactly where the prompt is weak before I send it to the target model.",
    name: "Marcus Lindqvist",
    role: "Senior Developer",
    img: 53,
  },
  {
    id: 2,
    quote:
      "It handled infrastructure prompts better than I expected. The constraint block includes things I'd forget to specify manually.",
    name: "Priya Nair",
    role: "Platform Engineer",
    img: 32,
  },
  {
    id: 3,
    quote:
      "The stated versus inferred breakdown made this genuinely useful. I can see exactly what was added to my request before I paste it anywhere.",
    name: "Sam Kirchner",
    role: "AI/ML Engineer",
    img: 60,
  },
  {
    id: 4,
    quote:
      "The visible diff between what I said and what was inferred has made me a better prompt writer. I catch my own gaps now.",
    name: "Yuki Tanaka",
    role: "Full-stack Developer",
    img: 15,
  },
];

const ROW_TWO: Testimonial[] = [
  {
    id: 5,
    quote:
      "Prompt history is quietly the best feature. Every prompt I've ever built is versioned and searchable. I reuse more than I rewrite.",
    name: "Nia Osei",
    role: "Technical Lead",
    img: 26,
  },
  {
    id: 6,
    quote:
      "The follow-up questions are sharp. When my request is missing critical context, it asks instead of guessing. That is the whole point.",
    name: "Leo Fernandes",
    role: "Backend Engineer",
    img: 59,
  },
  {
    id: 7,
    quote:
      "I paste the structured output straight into my coding assistant and the first response is usable. That almost never happened before.",
    name: "Amara Diallo",
    role: "Software Engineer",
    img: 44,
  },
  {
    id: 8,
    quote:
      "Assumption transparency is what won me over. I can see exactly what was added on my behalf and reject anything that is wrong.",
    name: "Jonas Weber",
    role: "DevOps Engineer",
    img: 68,
  },
  {
    id: 9,
    quote:
      "As someone who reviews AI-generated code daily, better prompts upstream means fewer bad diffs downstream. This tool pays for itself.",
    name: "Ines Moreau",
    role: "Engineering Manager",
    img: 5,
  },
];

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div className="shrink-0 w-[320px] sm:w-[360px] h-[200px] rounded-xl border border-border bg-surface p-5 flex flex-col gap-4">
      <p className="text-sm text-text-muted leading-relaxed flex-1 overflow-hidden">
        &ldquo;{t.quote}&rdquo;
      </p>
      <div className="flex items-center gap-3">
        <img
          src={`https://i.pravatar.cc/96?img=${t.img}`}
          alt={t.name}
          width={40}
          height={40}
          loading="lazy"
          className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
        />
        <div>
          <p className="text-sm font-semibold text-text-primary leading-none mb-1">
            {t.name}
          </p>
          <p className="text-xs text-text-faint">{t.role}</p>
        </div>
      </div>
    </div>
  );
}

function AutoScrollRow({
  items,
  reverse = false,
}: {
  items: Testimonial[];
  reverse?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    const el = ref.current;
    if (!el) return;
    let raf: number;
    const half = () => el.scrollWidth / 2;
    if (reverse) el.scrollLeft = half();
    const step = () => {
      if (!pausedRef.current) {
        el.scrollLeft += reverse ? -0.6 : 0.6;
        if (!reverse && el.scrollLeft >= half()) el.scrollLeft -= half();
        if (reverse && el.scrollLeft <= 0) el.scrollLeft += half();
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reverse, prefersReducedMotion]);

  return (
    <div
      ref={ref}
      className="flex gap-4 overflow-x-auto scrollbar-hide px-6 md:px-10 lg:px-16"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      onTouchStart={() => (pausedRef.current = true)}
      onTouchEnd={() => (pausedRef.current = false)}
    >
      {[...items, ...items].map((t, i) => (
        <TestimonialCard key={`${t.id}-${i}`} t={t} />
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section
      id="testimonials"
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
            From the community
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight mb-4">
            What developers say
          </h2>
          <p className="text-text-muted text-base leading-relaxed max-w-lg mx-auto">
            Developers using Prompt AI across different stacks, teams, and model
            targets.
          </p>
        </motion.div>
      </Container>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-col gap-4"
      >
        <AutoScrollRow items={ROW_ONE} />
        <AutoScrollRow items={ROW_TWO} reverse />
      </motion.div>
    </section>
  );
}
