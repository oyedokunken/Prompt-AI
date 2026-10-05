"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeaderView } from "@/components/dashboard/DashboardHeader";
import { MessageBubble } from "@/components/dashboard/MessageBubble";
import { GenerationStatus } from "@/components/dashboard/GenerationStatus";
import { ChatInput } from "@/components/dashboard/ChatInput";
import { MODELS, type ChatMessage, type ChatSession } from "@/lib/types/chat";

// This is the product itself, not a drawing of it. The sidebar, header, message
// bubbles and composer below are the same components the dashboard renders, fed
// with sample data, so the marketing page can never drift from what a visitor
// finds after they sign in.

const noop = () => {};
const now = () => new Date().toISOString();

function session(id: string, title: string, hoursAgo: number, extra: Partial<ChatSession> = {}): ChatSession {
  return {
    id,
    user_id: "preview",
    title,
    model: "gpt-4o",
    is_favorite: false,
    title_is_custom: false,
    created_at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    updated_at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    ...extra,
  };
}

const SESSIONS: ChatSession[] = [
  session("p1", "Rate limiting middleware", 0.2),
  session("p2", "Weekly status email", 1, { is_favorite: true }),
  session("p3", "Login form component", 3),
  session("p4", "CI pipeline setup", 30),
  session("p5", "JWT refresh endpoint", 55),
];
const PINNED = ["p2"];

interface Scenario {
  input: string;
  stage: string;
  title: string;
  prompt: string;
  preamble: string;
  score: number;
  stated: string[];
  inferred: string[];
  memory: { category: string; key: string; value: string }[];
  patterns: string[];
}

const SCENARIOS: Scenario[] = [
  {
    input: "write a prompt that reviews pull requests for my Rust CLI",
    stage: "Working out what a good review needs",
    title: "Rust CLI pull request review",
    preamble: "Here is a structured prompt for reviewing pull requests on your Rust CLI.",
    score: 78,
    stated: ["Reviews pull requests", "The project is a Rust CLI"],
    inferred: ["Flag unsafe code and missing tests", "Answer with a short checklist", "Skip formatting nits"],
    memory: [{ category: "projects", key: "Current project", value: "A CLI that parses logs in Rust" }],
    patterns: ["Role, rules and output format"],
    prompt: [
      "Role",
      "You are a code review assistant for a Rust command line tool that parses logs.",
      "",
      "Task",
      "Review the pull request and report anything unsafe, untested or unclear.",
      "",
      "Rules",
      "Only flag issues that affect correctness or maintainability. Ignore formatting handled by tools.",
      "",
      "Output format",
      "A short checklist: unsafe code, missing tests, error handling, ready to merge.",
    ].join("\n"),
  },
  {
    input: "turn my meeting notes into a weekly status email",
    stage: "Reading your request",
    title: "Weekly status email",
    preamble: "Here is a prompt that turns raw meeting notes into a status email.",
    score: 71,
    stated: ["Source is meeting notes", "The result is a weekly email"],
    inferred: ["Audience is the wider team", "Lead with decisions, then blockers", "Keep it under 200 words"],
    memory: [],
    patterns: ["Summarize with a fixed structure"],
    prompt: [
      "Role",
      "You write clear weekly status emails for a busy team.",
      "",
      "Task",
      "Turn the pasted meeting notes into one status email.",
      "",
      "Rules",
      "Lead with decisions, then blockers, then next steps. Keep it under 200 words. Do not invent details that are not in the notes.",
      "",
      "Output format",
      "A subject line, then the email body in short paragraphs.",
    ].join("\n"),
  },
];

type Phase = "typing" | "sending" | "thinking" | "answered";

function buildMessages(s: Scenario, withAnswer: boolean): ChatMessage[] {
  const user: ChatMessage = { id: "u", session_id: "p1", role: "user", content: s.input, metadata: {}, created_at: now() };
  if (!withAnswer) return [user];
  return [
    user,
    {
      id: "a",
      session_id: "p1",
      role: "assistant",
      content: s.prompt,
      created_at: now(),
      metadata: {
        mode: "ready",
        formatStyle: "plain",
        preamble: s.preamble,
        score: s.score,
        readiness: { status: "ready" },
        diff: { stated: s.stated, inferred: s.inferred, researched: [] },
        memoryUsed: s.memory,
        patternsUsed: s.patterns,
      },
    },
  ];
}

export function ProductWindow() {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [typed, setTyped] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const scenario = SCENARIOS[index] as Scenario;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || reduced) return;
    let timer: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (typed < scenario.input.length) timer = setTimeout(() => setTyped((n) => n + 1), 45 + Math.random() * 35);
      else timer = setTimeout(() => setPhase("sending"), 600);
    } else if (phase === "sending") {
      timer = setTimeout(() => setPhase("thinking"), 500);
    } else if (phase === "thinking") {
      timer = setTimeout(() => setPhase("answered"), 1700);
    } else {
      timer = setTimeout(() => {
        setTyped(0);
        setIndex((i) => (i + 1) % SCENARIOS.length);
        setPhase("typing");
      }, 6500);
    }
    return () => clearTimeout(timer);
  }, [mounted, reduced, phase, typed, scenario]);

  const showAnswer = reduced || phase === "answered";
  const showUser = reduced || phase !== "typing";
  const composerText = reduced || phase !== "typing" ? "" : scenario.input.slice(0, typed);
  const messages = showUser ? buildMessages(scenario, showAnswer) : [];

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [phase, index]);

  return (
    <div
      className="rounded-xl border border-border bg-base text-text-primary shadow-2xl overflow-hidden flex h-[600px] text-left"
      role="img"
      aria-label="The Prompt AI workspace: a chat list on the left, a request being turned into a structured prompt on the right"
    >
      {/* Nothing in the preview can be clicked or focused, it is a picture of the product. */}
      <div className="contents pointer-events-none select-none" aria-hidden="true" {...({ inert: "" } as object)}>
        <Sidebar
          sessions={SESSIONS}
          pinnedIds={PINNED}
          previewActiveId="p1"
          onNewChat={noop}
          onDeleteSession={noop}
          username="oyedokunken"
          avatarUrl={null}
          preferredName="Kenny"
          roleDisplay="Software engineer"
          onSettings={noop}
          onSignOut={noop}
          collapsed={false}
          onToggleCollapse={noop}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <DashboardHeaderView username="oyedokunken" />
          <div className="flex-1 flex flex-col min-h-0">
            <div ref={scroller} className="flex-1 overflow-y-auto scrollbar-hide px-4 sm:px-6 py-5 flex flex-col gap-5">
              {mounted && messages.map((m) => <MessageBubble key={m.id} message={m} onFeedback={noop} onSave={m.role === "assistant" ? noop : undefined} />)}
              {mounted && !reduced && phase === "thinking" && <GenerationStatus message={scenario.stage} />}
            </div>
            <ChatInput
              value={composerText}
              onChange={noop}
              onSend={noop}
              model={MODELS[0]}
              onModelChange={noop}
              placeholder="Start a new chat"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
