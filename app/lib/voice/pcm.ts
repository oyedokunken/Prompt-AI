// Turns what the microphone gives the browser into what the live transcription
// socket wants: mono, 16 bit signed integers at 24kHz. Browsers capture at
// 44.1kHz or 48kHz, so the audio is resampled here, on the device, before it is
// sent. Pure and stateful only in the resampling position, so it can be tested.

export const TARGET_RATE = 24_000;

export class Resampler {
  private position = 0;

  constructor(private readonly inputRate: number, private readonly outputRate: number = TARGET_RATE) {}

  // Linear interpolation between neighbouring input samples. The fractional
  // position carries over between calls so the output rate stays exact.
  push(input: Float32Array): Int16Array {
    const step = this.inputRate / this.outputRate;
    const out: number[] = [];
    let pos = this.position;
    while (pos < input.length) {
      const index = Math.floor(pos);
      const frac = pos - index;
      const a = input[index] as number;
      const b = index + 1 < input.length ? (input[index + 1] as number) : (input[index] as number);
      out.push(toInt16(a + (b - a) * frac));
      pos += step;
    }
    this.position = pos - input.length;
    return Int16Array.from(out);
  }
}

export function toInt16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
}

// How loud a chunk is, 0 to 1, for the level meter.
export function level(samples: Float32Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += (samples[i] as number) ** 2;
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}
