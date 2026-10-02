"use client";

import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Container } from "@/components/Container";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started. No credit card required.",
    features: [
      "20 prompt generations per day",
      "GPT-4o, with more models planned",
      "Completeness scoring",
      "7-day prompt history",
      "Community support",
    ],
    cta: "Start free",
    href: "/signup",
    highlighted: false,
    badge: null,
  },
  {
    name: "Pro",
    price: "$12",
    period: "per month",
    description: "For individuals who use AI seriously.",
    features: [
      "Unlimited prompt generations",
      "All 14+ supported models",
      "Full prompt history and versioning",
      "Saved prompt library",
      "Visible diff on all inferences",
      "API access",
      "Email support",
    ],
    cta: "Get Pro",
    href: "/signup?plan=pro",
    highlighted: true,
    badge: "Most popular",
  },
  {
    name: "Team",
    price: "$49",
    period: "per month",
    description: "For teams shipping AI-powered products.",
    features: [
      "Everything in Pro",
      "Shared team workspace",
      "Team prompt library",
      "Role-based access control",
      "Usage analytics dashboard",
      "Custom model routing",
      "Priority support",
    ],
    cta: "Contact us",
    href: "mailto:hello@promptgpt.app",
    highlighted: false,
    badge: null,
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export function Pricing() {
  return (
    <section id="pricing" className="py-16 lg:py-24 border-t border-border-subtle">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14 max-w-2xl mx-auto"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">
            Pricing
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-text-muted text-base leading-relaxed">
            Free to start. Upgrade when you need unlimited generations, more
            models, and API access.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {PLANS.map((plan) => (
            <motion.div
              key={plan.name}
              variants={item}
              className={`rounded-xl border flex flex-col p-6 relative ${
                plan.highlighted
                  ? "border-accent/40 bg-surface shadow-[0_0_40px_rgba(242,169,59,0.06)]"
                  : "border-border bg-surface"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-accent-fill text-accent-fill-foreground border border-accent-fill/50 whitespace-nowrap">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className="text-sm font-semibold text-text-primary mb-1">
                  {plan.name}
                </p>
                <div className="flex items-end gap-1.5 mb-2">
                  <span className="text-4xl font-bold text-text-primary leading-none">
                    {plan.price}
                  </span>
                  <span className="text-sm text-text-faint mb-1">
                    {plan.period}
                  </span>
                </div>
                <p className="text-sm text-text-muted">{plan.description}</p>
              </div>

              <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check
                      size={14}
                      className={`shrink-0 mt-0.5 ${plan.highlighted ? "text-accent" : "text-signal"}`}
                    />
                    <span className="text-sm text-text-muted leading-snug">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                {...(plan.href.startsWith("mailto") ? {} : {})}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  plan.highlighted
                    ? "bg-accent-fill text-accent-fill-foreground hover:bg-accent-fill/90"
                    : "border border-border bg-raised hover:bg-raised/80 text-text-primary"
                }`}
              >
                {plan.cta}
                {plan.highlighted && <ArrowRight size={14} />}
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center text-xs text-text-faint mt-8 font-mono"
        >
          All plans include a 14-day Pro trial on signup. No credit card required for Free.
        </motion.p>
      </Container>
    </section>
  );
}
