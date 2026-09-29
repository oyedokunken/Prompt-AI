"use client";

import { useRef, useEffect } from "react";
import { ArrowRight, Paperclip, Loader2 } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onAttach?: (file: File) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onAttach,
  disabled = false,
  placeholder = "Describe what you need — plain language works best",
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea up to ~5 lines
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAttach) onAttach(file);
    e.target.value = "";
  };

  return (
    <div className="px-4 sm:px-6 pb-4 pt-2">
      <div
        className={`flex items-end gap-2 rounded-xl border bg-raised px-3 py-2.5 transition-colors ${
          disabled ? "border-border opacity-60" : "border-border focus-within:border-accent/40"
        }`}
      >
        {/* Attach */}
        <label className="p-1 text-text-faint hover:text-text-muted transition-colors cursor-pointer shrink-0 mb-0.5" aria-label="Attach file">
          <Paperclip size={14} />
          <input
            type="file"
            className="hidden"
            accept="image/*,video/*,.pdf"
            onChange={handleFile}
            disabled={disabled}
          />
        </label>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-faint resize-none overflow-hidden leading-relaxed"
          style={{ maxHeight: 120 }}
        />

        {/* Send */}
        <div className="flex items-center gap-2 shrink-0 mb-0.5">
          <span className="font-mono text-[10px] text-text-faint hidden sm:block">⏎</span>
          <button
            onClick={onSend}
            disabled={disabled || !value.trim()}
            className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
            aria-label="Send"
          >
            {disabled ? (
              <Loader2 size={13} className="text-base animate-spin" />
            ) : (
              <ArrowRight size={13} style={{ color: "#0A0A0B" }} />
            )}
          </button>
        </div>
      </div>
      <p className="text-center text-[9px] text-text-faint mt-1.5">
        Shift+Enter for new line · Enter to send
      </p>
    </div>
  );
}
