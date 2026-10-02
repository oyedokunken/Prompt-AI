// Live transcription. Microphone audio is resampled to 24kHz PCM on the device
// and streamed over a WebSocket straight to the /data service, which relays it
// to OpenAI's realtime transcription and sends text back as phrases are
// recognised. The browser connects to /data directly because the serverless
// /api cannot hold a socket open; /api only mints the short lived ticket.

import { fetchTranscribeTicket } from "@/lib/api/chatApi";
import { Resampler, TARGET_RATE, level } from "./pcm";
import { TranscriptAssembler, type TranscriptEvent } from "./transcriptAssembler";

// Runs on the audio thread. Collects the 128 sample blocks the browser hands
// it into larger chunks so the main thread is not woken a few hundred times a
// second.
const WORKLET_SOURCE = `
class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(2048); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
    }
    return true;
  }
}
registerProcessor("capture", Capture);
`;

const FLUSH_WAIT_MS = 9000;

export interface LiveOptions {
  onText: (text: string) => void;
  onLevel?: (level: number) => void;
  onError?: (message: string) => void;
}

export function liveTranscriptionSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof WebSocket !== "undefined" &&
    typeof AudioContext !== "undefined" &&
    typeof AudioWorkletNode !== "undefined"
  );
}

export class LiveTranscriber {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private ws: WebSocket | null = null;
  private resampler: Resampler | null = null;
  private assembler = new TranscriptAssembler();
  private pending: ArrayBuffer[] = [];
  private ready = false;
  private failed = false;
  private finished: (() => void) | null = null;
  private workletUrl: string | null = null;

  constructor(private readonly options: LiveOptions) {}

  // Starts capturing immediately and connects in the background. Audio spoken
  // while the socket is still opening is held and sent as soon as it is ready,
  // so the first words are not lost.
  async start(stream: MediaStream): Promise<void> {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.resampler = new Resampler(ctx.sampleRate, TARGET_RATE);
    this.workletUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
    await ctx.audioWorklet.addModule(this.workletUrl);
    this.source = ctx.createMediaStreamSource(stream);
    this.node = new AudioWorkletNode(ctx, "capture");
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => this.onAudio(e.data);
    // Connected to nothing that is audible, the node only needs to be pulled.
    const silent = ctx.createGain();
    silent.gain.value = 0;
    this.source.connect(this.node);
    this.node.connect(silent).connect(ctx.destination);
    void this.connect();
  }

  private async connect(): Promise<void> {
    try {
      const { ticket, url } = await fetchTranscribeTicket();
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      this.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: "auth", ticket }));
      ws.onmessage = (e) => this.onMessage(e.data);
      ws.onerror = () => this.fail("Live transcription could not connect");
      ws.onclose = () => {
        if (!this.ready) this.fail("Live transcription could not connect");
        this.finished?.();
      };
    } catch {
      this.fail("Live transcription is unavailable");
    }
  }

  private fail(message: string): void {
    if (this.failed) return;
    this.failed = true;
    this.options.onError?.(message);
    this.finished?.();
  }

  private onAudio(samples: Float32Array): void {
    if (this.failed) return;
    this.options.onLevel?.(level(samples));
    const pcm = this.resampler!.push(samples);
    const buffer = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength) as ArrayBuffer;
    if (this.ready && this.ws?.readyState === WebSocket.OPEN) this.ws.send(buffer);
    else this.pending.push(buffer);
  }

  private onMessage(raw: unknown): void {
    if (typeof raw !== "string") return;
    let message: { type: string; [key: string]: unknown };
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    switch (message.type) {
      case "ready":
        this.ready = true;
        for (const chunk of this.pending) this.ws?.send(chunk);
        this.pending = [];
        break;
      case "order":
      case "delta":
      case "final":
        this.assembler.apply(message as unknown as TranscriptEvent);
        this.options.onText(this.assembler.text());
        break;
      case "error":
        // The text gathered so far is kept, only new text stops arriving.
        this.fail(String(message.message ?? "Live transcription stopped"));
        break;
      case "done":
        this.finished?.();
        break;
    }
  }

  // Stops the microphone, tells the server to finish the phrase being spoken,
  // and waits for its last text. Resolves with whether live transcription
  // worked, so the caller can fall back to a normal upload if it did not.
  async stop(): Promise<{ text: string; ok: boolean }> {
    this.source?.disconnect();
    this.node?.disconnect();
    if (this.node) this.node.port.onmessage = null;

    if (!this.failed && this.ws?.readyState === WebSocket.OPEN && this.ready) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, FLUSH_WAIT_MS);
        this.finished = () => {
          clearTimeout(timer);
          resolve();
        };
        this.ws?.send(JSON.stringify({ type: "stop" }));
      });
    }

    const text = this.assembler.text();
    this.dispose();
    return { text, ok: !this.failed || text.length > 0 };
  }

  dispose(): void {
    try {
      this.ws?.close();
    } catch {
      // already closed
    }
    void this.ctx?.close().catch(() => undefined);
    if (this.workletUrl) URL.revokeObjectURL(this.workletUrl);
    this.ws = null;
    this.ctx = null;
    this.workletUrl = null;
  }
}
