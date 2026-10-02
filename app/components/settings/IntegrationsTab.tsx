"use client";

import {
  siGithub, siSlack, siNotion, siGoogledrive, siLinear, siJira, siObsidian, siZapier, siDiscord,
  type SimpleIcon,
} from "simple-icons";

interface PlannedIntegration {
  icon: SimpleIcon;
  name: string;
  summary: string;
}

// What is planned, in plain terms. None of it is connected or functional, this
// tab is a preview and says so.
const PLANNED: { group: string; items: PlannedIntegration[] }[] = [
  {
    group: "Where your prompts go",
    items: [
      { icon: siNotion, name: "Notion", summary: "Send a finished prompt to a Notion page or database." },
      { icon: siObsidian, name: "Obsidian", summary: "Save prompts as Markdown notes in your vault." },
      { icon: siGoogledrive, name: "Google Drive", summary: "Keep exports and attachments in a Drive folder." },
    ],
  },
  {
    group: "Where your work lives",
    items: [
      { icon: siGithub, name: "GitHub", summary: "Start from an issue or pull request and keep prompts alongside the code." },
      { icon: siLinear, name: "Linear", summary: "Turn a Linear issue into a ready-to-run prompt." },
      { icon: siJira, name: "Jira", summary: "Build a prompt from a ticket and its comments." },
    ],
  },
  {
    group: "Where your team talks",
    items: [
      { icon: siSlack, name: "Slack", summary: "Share prompts to a channel and build them without leaving Slack." },
      { icon: siDiscord, name: "Discord", summary: "Post and discuss prompts with a community server." },
      { icon: siZapier, name: "Zapier", summary: "Connect Prompt AI to the other apps you already automate." },
    ],
  },
];

// A very dark brand colour disappears on a dark background, so those icons
// take the page's ink colour instead of their own.
function brandColour(hex: string): string | undefined {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.2 ? undefined : `#${hex}`;
}

export function IntegrationsTab() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-text-primary mb-6">Integrations</h1>
      <div className="space-y-8">
        {PLANNED.map(({ group, items }) => (
          <section key={group} aria-label={group}>
            <h2 className="font-mono text-[13px] md:text-[13px] uppercase tracking-widest text-text-faint mb-3">{group}</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map(({ icon, name, summary }) => (
                <li
                  key={name}
                  className="flex items-start gap-3.5 rounded-xl border border-border bg-surface p-4 opacity-90"
                >
                  <span className="w-11 h-11 shrink-0 rounded-lg border border-border bg-base flex items-center justify-center">
                    <svg
                      viewBox="0 0 24 24"
                      width={24}
                      height={24}
                      role="img"
                      aria-label={`${name} logo`}
                      fill={brandColour(icon.hex) ?? "currentColor"}
                      className="text-text-primary"
                    >
                      <path d={icon.path} />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-text-primary">{name}</p>
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs md:text-xs font-mono uppercase tracking-wide text-text-faint">
                        Planned
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">{summary}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
