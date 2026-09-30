import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// POST /api/transcribe
// Accepts a recorded voice message and returns the transcribed text using
// OpenAI's transcription endpoint. The caller inserts the returned text into
// the chat input for review, this route never sends anything automatically.
// ---------------------------------------------------------------------------

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!openai) {
    return NextResponse.json({ error: "Voice transcription is not configured" }, { status: 503 });
  }

  const formData = await req.formData();
  const audio = formData.get("audio");
  if (!audio || typeof audio === "string") {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }

  if (audio.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Recording is too long, keep voice messages under 15MB" }, { status: 413 });
  }

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
    });
    return NextResponse.json({ text: transcription.text });
  } catch (err) {
    console.error("[transcribe] OpenAI error:", err);
    const message = err instanceof Error ? err.message : "Could not transcribe audio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
