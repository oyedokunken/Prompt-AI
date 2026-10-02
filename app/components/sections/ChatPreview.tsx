"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Container } from "@/components/Container";
import { MessageBubble, ReadinessBadge, ScoreBadge } from "@/components/dashboard/MessageBubble";
import type { ChatMessage } from "@/lib/types/chat";

// The conversation on the left is the product's own message component, fed a
// sample reply with every disclosure open. The notes on the right explain the
// parts of it that are real features, using the real badges.

const PROMPT = [
  "Role",
  "You are a senior backend engineer working in Node.js and Express.",
  "",
  "Task",
  "Build a POST /auth/refresh endpoint that reads the refresh token from an httpOnly cookie, checks it against the stored hash, rotates it and issues a new access token.",
  "",
  "Rules",
  "Rate limit the route. Use parameterized SQL. Return 401 with a structured error code when the token is invalid or reused.",
  "",
  "Output format",
  "The route handler, the middleware and short JSDoc comments.",
].join("\n");

function sample(): ChatMessage[] {
  const at = new Date().toISOString();
  return [
    { id: "u", session_id: "preview", role: "user", content: "write a jwt refresh token endpoint", metadata: {}, created_at: at },
    {
      id: "a",
      session_id: "preview",
      role: "assistant",
      content: PROMPT,
      created_at: at,
      metadata: {
        mode: "ready",
        formatStyle: "plain",
        preamble: "Here is a structured prompt for a refresh token endpoint.",
        score: 82,
        readiness: { status: "ready" },
        diff: {
          stated: ["A JWT refresh token endpoint"],
          inferred: ["Node.js with Express", "Refresh token in an httpOnly cookie", "Rotate the token on every use", "401 with a structured error code"],
          researched: [],
        },
        memoryUsed: [{ category: "skills", key: "Stack", value: "Node.js, Express, PostgreSQL" }],
        patternsUsed: ["Role, rules and output format"],
      },
    },
  ];
}

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

const NOTES = [
  {
    title: "Stated and inferred, kept apart",
    body: "Open the count under any reply to see what you said and what Prompt AI filled in for you. Nothing is added silently.",
    badge: null,
  },
  {
    title: "An estimate, not a grade",
    body: "Each prompt gets a rough completeness estimate and a readiness flag, so you can tell a prompt that is ready to use from one that still needs context.",
    badge: "score",
  },
  {
    title: "Your memory, in plain view",
    body: "When stored details about you shaped a reply, they are listed beneath it, and you can edit or remove them from Settings.",
    badge: null,
  },
];

export function ChatPreview() {
  // Built after mount so the message timestamp matches the visitor's own clock.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => setMessages(sample()), []);

  return (
    <section id="chat-preview" className="py-16 lg:py-24 border-t border-border-subtle">
      <Container>
        <motion.div variants={gridVariants} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <motion.div variants={cardVariant} className="text-center mb-10 max-w-2xl mx-auto">
            <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">In practice</p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight mb-4">
              What you type. What you get.
            </h2>
            <p className="text-text-muted text-base leading-relaxed">
              You write a sentence. Prompt AI returns a complete prompt with a role, the task, rules and an output
              format, and shows you which parts were yours and which it added.
            </p>
          </motion.div>

          <motion.div variants={cardVariant} className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
            <div
              className="lg:col-span-3 rounded-xl border border-border bg-base p-4 sm:p-6 flex flex-col gap-5 select-none"
              role="img"
              aria-label="A sample conversation in Prompt AI: a request, and the structured prompt returned with its stated and inferred details open"
            >
              <div className="contents pointer-events-none" aria-hidden="true" {...({ inert: "" } as object)}>
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} defaultExpanded onSave={m.role === "assistant" ? () => {} : undefined} onFeedback={() => {}} />
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-4">
              {NOTES.map((note) => (
                <div key={note.title} className="rounded-xl border border-border bg-surface p-5">
                  <p className="font-mono text-xs uppercase tracking-widest text-text-faint mb-2">{note.title}</p>
                  <p className="text-sm text-text-muted leading-relaxed">{note.body}</p>
                  {note.badge === "score" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <ReadinessBadge status="ready" />
                      <ScoreBadge score={82} />
                      <ReadinessBadge status="needs_context" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
