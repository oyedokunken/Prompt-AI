// Decides when a spoken message is over, so recording can stop by itself. Pure
// and driven by the clock it is given, so it can be tested without a browser.
//
// Speech is told from background noise by loudness. Once the speaker has been
// heard, a stretch of quiet ends the message. New text from the transcriber
// also counts as the speaker still talking, which covers someone speaking
// softly. If nothing is ever heard, it gives up after a while instead of
// listening forever.

export type EndpointDecision = "listening" | "silence" | "no-speech" | "too-long";

export interface EndpointOptions {
  // Loudness, 0 to 1, at or above which a frame counts as speech.
  speechLevel: number;
  // Quiet that ends a message once speech has been heard.
  silenceMs: number;
  // How long to wait for the first word before giving up.
  noSpeechMs: number;
  // A hard ceiling on one message.
  maxMs: number;
}

export const DEFAULT_ENDPOINT: EndpointOptions = {
  speechLevel: 0.1,
  silenceMs: 1800,
  noSpeechMs: 10_000,
  maxMs: 120_000,
};

export class EndpointDetector {
  private startedAt: number | null = null;
  private heardSpeech = false;
  private lastSpeechAt = 0;

  constructor(private readonly options: EndpointOptions = DEFAULT_ENDPOINT) {}

  noteText(now: number): void {
    this.heardSpeech = true;
    this.lastSpeechAt = now;
  }

  update(level: number, now: number): EndpointDecision {
    if (this.startedAt === null) this.startedAt = now;
    if (level >= this.options.speechLevel) {
      this.heardSpeech = true;
      this.lastSpeechAt = now;
    }
    if (now - this.startedAt >= this.options.maxMs) return "too-long";
    if (this.heardSpeech) {
      return now - this.lastSpeechAt >= this.options.silenceMs ? "silence" : "listening";
    }
    return now - this.startedAt >= this.options.noSpeechMs ? "no-speech" : "listening";
  }
}
