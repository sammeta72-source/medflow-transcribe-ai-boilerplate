// MedFlow AI Operations Copilot — speech-to-text endpoint (server-side only).
// Uses z-ai-web-dev-sdk (server-side singleton via ZAI.create()).
//
// POST body: { audio: string (base64, may include data URI prefix) }
// Response:  { text: string } | { error: string }

import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AsrRequestBody {
  audio?: string;
}

// Strip a "data:audio/webm;base64," or similar prefix.
function stripDataUri(audio: string): string {
  const trimmed = audio.trim();
  const match = trimmed.match(/^data:audio\/[a-zA-Z0-9.+-]+;base64,(.+)$/s);
  if (match) return match[1];
  return trimmed;
}

export async function POST(req: Request) {
  let body: AsrRequestBody;
  try {
    body = (await req.json()) as AsrRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.audio || typeof body.audio !== "string" || body.audio.trim().length === 0) {
    return NextResponse.json(
      { error: "audio (base64 string) is required" },
      { status: 400 },
    );
  }

  const cleanBase64 = stripDataUri(body.audio);
  if (cleanBase64.length < 16) {
    return NextResponse.json(
      { error: "audio payload too short" },
      { status: 400 },
    );
  }

  try {
    const zai = await ZAI.create();
    const result = await zai.audio.asr.create({ file_base64: cleanBase64 });

    // The SDK returns a flexible object — pull the text from common shapes.
    const text: string | undefined =
      result?.text ??
      result?.transcript ??
      (typeof result === "string" ? result : undefined) ??
      (result?.data?.text ?? undefined);

    if (!text) {
      return NextResponse.json(
        { error: "ASR returned no text", raw: JSON.stringify(result).slice(0, 400) },
        { status: 502 },
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `ASR failed: ${message}` },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/chat/asr",
    method: "POST",
    body: { audio: "base64 string (data URI prefix optional)" },
  });
}
