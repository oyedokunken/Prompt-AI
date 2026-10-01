"use client";

import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, Paperclip, Loader2, Smile, Mic, Square, ChevronDown } from "lucide-react";
import type { EmojiClickData } from "emoji-picker-react";
import { MODELS } from "@/lib/types/chat";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onAttach?: (files: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
  model: (typeof MODELS)[number];
  onModelChange: (m: (typeof MODELS)[number]) => void;
}

// Lives here, not the header, model selection happens in the same place
// the user is actually composing the request. Opens upward since this
// control sits at the bottom of the screen.
function ModelSelector({
  model, onSelect,
}: {
  model: (typeof MODELS)[number];
  onSelect: (m: (typeof MODELS)[number]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-surface cursor-pointer hover:border-border/60 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-signal" />
        <span className="font-mono text-[10px] text-text-muted">{model.label}</span>
        <ChevronDown size={10} className="text-text-faint" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 bottom-full mb-1 w-52 rounded-lg border border-border bg-surface shadow-xl z-20 overflow-hidden">
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={!m.openaiModel}
                onClick={() => { onSelect(m); setOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-[11px] transition-colors ${
                  !m.openaiModel
                    ? "text-text-faint cursor-not-allowed"
                    : m.id === model.id
                    ? "text-accent bg-accent/10"
                    : "text-text-muted hover:bg-raised"
                }`}
              >
                <span>{m.label}</span>
                {!m.openaiModel && (
                  <span className="text-[8px] font-mono uppercase tracking-wide border border-border rounded px-1 py-0.5">
                    Coming soon
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export interface ChatInputHandle {
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput({
  value,
  onChange,
  onSend,
  onAttach,
  disabled = false,
  placeholder = "Describe what you need, plain language works best",
  model,
  onModelChange,
}, ref) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(value);

  useImperativeHandle(ref, () => ({
    focus: () => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      // Put the cursor at the end rather than selecting or leaving it at 0.
      const len = el.value.length;
      el.setSelectionRange(len, len);
    },
  }));
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

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

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length && onAttach) onAttach(files);
    e.target.value = "";
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onChange(valueRef.current + emojiData.emoji);
    textareaRef.current?.focus();
  };

  const startRecording = async () => {
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setIsTranscribing(true);
        try {
          const audioForm = new FormData();
          audioForm.append("audio", blob, "voice-message.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: audioForm });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload.error ?? "Transcription failed");
          if (payload.text) {
            const current = valueRef.current;
            onChange(current ? `${current} ${payload.text}`.trim() : payload.text);
          }
        } catch (err) {
          setVoiceError(err instanceof Error ? err.message : "Could not transcribe audio");
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setVoiceError("Microphone access was denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const busy = disabled || isTranscribing;

  return (
    <div className="px-4 sm:px-6 pb-4 pt-2">
      <div className="flex items-center mb-1.5">
        <ModelSelector model={model} onSelect={onModelChange} />
      </div>
      {voiceError && (
        <p className="text-[10px] text-red-400 mb-1.5">{voiceError}</p>
      )}
      <div
        className={`flex items-end gap-2 rounded-xl border bg-raised px-3 py-2.5 transition-colors ${
          busy ? "border-border opacity-60" : "border-border focus-within:border-accent/40"
        }`}
      >
        {/* Attach */}
        <label className="p-1 text-text-faint hover:text-text-muted transition-colors cursor-pointer shrink-0 mb-0.5" aria-label="Attach files">
          <Paperclip size={14} />
          <input
            type="file"
            multiple
            className="hidden"
            accept="image/*,video/*,.pdf"
            onChange={handleFiles}
            disabled={busy}
          />
        </label>

        {/* Emoji */}
        <div className="relative shrink-0 mb-0.5">
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            disabled={busy}
            className="p-1 text-text-faint hover:text-text-muted transition-colors"
            aria-label="Insert emoji"
          >
            <Smile size={14} />
          </button>
          {showEmoji && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowEmoji(false)} />
              <div className="absolute bottom-9 left-0 z-20">
                <EmojiPicker onEmojiClick={handleEmojiClick} width={300} height={360} />
              </div>
            </>
          )}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={isTranscribing ? "Transcribing your voice message..." : placeholder}
          disabled={busy}
          rows={1}
          className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-faint resize-none overflow-hidden leading-relaxed"
          style={{ maxHeight: 120 }}
        />

        {/* Voice */}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isTranscribing}
          className={`shrink-0 mb-0.5 p-1 transition-colors ${
            isRecording ? "text-red-400" : "text-text-faint hover:text-text-muted"
          }`}
          aria-label={isRecording ? "Stop recording" : "Record a voice message"}
        >
          {isRecording ? (
            <span className="relative flex items-center justify-center w-3.5 h-3.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60 animate-ping" />
              <Square size={10} className="relative fill-current" />
            </span>
          ) : (
            <Mic size={14} />
          )}
        </button>

        {/* Send */}
        <div className="flex items-center gap-2 shrink-0 mb-0.5">
          <span className="font-mono text-[10px] text-text-faint hidden sm:block">⏎</span>
          <button
            onClick={onSend}
            disabled={busy || !value.trim()}
            className="w-7 h-7 rounded-lg bg-accent-fill text-accent-fill-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-fill/90 transition-colors"
            aria-label="Send"
          >
            {busy ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <ArrowRight size={13} />
            )}
          </button>
        </div>
      </div>
      <p className="text-center text-[9px] text-text-faint mt-1.5 truncate">
        Shift+Enter for new line · Enter to send · Review outputs and generated code before use.
      </p>
    </div>
  );
});
