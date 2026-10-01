"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

// Renders a chat reply as real formatted text, so headers, bold, italics and
// lists show as formatting instead of literal symbols. Line breaks are kept,
// since generated prompts are often plain text with one line per thought.
// Raw HTML is never rendered, anything tag-like is shown as text.
const components: Components = {
  h1: ({ children }) => <h1 className="text-base font-semibold text-text-primary mt-3 mb-1.5 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-[15px] font-semibold text-text-primary mt-3 mb-1.5 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-text-primary mt-2.5 mb-1 first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="text-sm font-medium text-text-primary mt-2 mb-1 first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="leading-relaxed my-1.5 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="border-border my-3" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 my-2 text-text-muted">{children}</blockquote>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:text-accent/80">
      {children}
    </a>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className={`${className} font-mono text-[12px]`}>{children}</code>
    ) : (
      <code className="font-mono text-[12px] px-1 py-0.5 rounded bg-raised border border-border">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="my-2 p-3 rounded-lg bg-raised border border-border overflow-x-auto text-[12px] leading-relaxed">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border px-2 py-1 text-left font-semibold bg-raised">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
