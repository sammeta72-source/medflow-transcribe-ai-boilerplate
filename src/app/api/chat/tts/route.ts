// MedFlow AI Operations Copilot — text-to-speech endpoint (server-side only).
// Uses z-ai-web-dev-sdk (server-side singleton via ZAI.create()).
//
// POST body: { text: string, voice?: string }
// Response:  audio/wav binary (Buffer body) — client plays via <audio> element.
//            The ZAI provider rejects response_format='mp3' (HTTP 400 /
//            code 1214), so we fall back through mp3 → wav → no-format.
//            on error: JSON { error: string } with 500.

import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TtsRequestBody {
  text?: string;
  voice?: string;
}

const MAX_TTS_CHARS = 1000;
const DEFAULT_VOICE = "tongtong";

// The ZAI SDK TTS response shape varies by provider/voice — it may be a
// fetch-Response, an ArrayBuffer, a Uint8Array, a base64 string, or a wrapper
// object with `.data`. We narrow at runtime.
type TtsResponseShape =
  | ArrayBuffer
  | Uint8Array
  | { arrayBuffer(): Promise<ArrayBuffer> }
  | { data: ArrayBuffer }
  | string
  | { [key: string]: unknown };

function isFetchResponseLike(v: TtsResponseShape): v is { arrayBuffer(): Promise<ArrayBuffer> } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { arrayBuffer?: unknown }).arrayBuffer === "function"
  );
}

function isDataWrapper(v: TtsResponseShape): v is { data: ArrayBuffer } {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { data?: unknown }).data instanceof ArrayBuffer
  );
}

// Pull an ArrayBuffer out of the assorted shapes the SDK may return.
async function extractBuffer(response: TtsResponseShape): Promise<ArrayBuffer | null> {
  if (response instanceof ArrayBuffer) return response;
  if (response instanceof Uint8Array) {
    return response.buffer.slice(
      response.byteOffset,
      response.byteOffset + response.byteLength,
    ) as ArrayBuffer;
  }
  if (isFetchResponseLike(response)) return response.arrayBuffer();
  if (isDataWrapper(response)) return response.data;
  return null;
}

function audioResponse(buffer: Buffer, mimeType: string) {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: Request) {
  let body: TtsRequestBody;
  try {
    body = (await req.json()) as TtsRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.text || typeof body.text !== "string" || body.text.trim().length === 0) {
    return NextResponse.json(
      { error: "text (string) is required" },
      { status: 400 },
    );
  }

  const voice =
    typeof body.voice === "string" && body.voice.trim().length > 0
      ? body.voice.trim()
      : DEFAULT_VOICE;

  // Truncate to keep responses fast and under provider limits.
  const text = body.text.slice(0, MAX_TTS_CHARS);

  try {
    const zai = await ZAI.create();

    // Provider quirk: `mp3` is rejected with code 1214 ("response_format
    // value not supported"). We try `mp3` first (per spec), then fall back
    // to `wav` (which the provider accepts and is the only container format
    // playable by <audio> from this provider), then a no-format default.
    const attempts: Array<{ response_format?: string; mimeType: string }> = [
      { response_format: "mp3", mimeType: "audio/mpeg" },
      { response_format: "wav", mimeType: "audio/wav" },
      { mimeType: "audio/wav" },
    ];

    let lastError: string | null = null;
    for (const attempt of attempts) {
      try {
        const response = (await zai.audio.tts.create({
          input: text,
          voice,
          speed: 1.0,
          ...(attempt.response_format ? { response_format: attempt.response_format } : {}),
          stream: false,
        })) as TtsResponseShape;

        // Some voices return a base64 string; decode + short-circuit.
        if (typeof response === "string") {
          const buf = Buffer.from(response, "base64");
          return audioResponse(buf, attempt.mimeType);
        }

        const arrayBuffer = await extractBuffer(response);
        if (!arrayBuffer) {
          lastError = `Unexpected TTS response shape (${attempt.response_format ?? "default"})`;
          continue;
        }
        const buffer = Buffer.from(new Uint8Array(arrayBuffer));
        return audioResponse(buffer, attempt.mimeType);
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        // Try the next format.
        continue;
      }
    }

    return NextResponse.json(
      { error: `TTS failed: ${lastError ?? "unknown error"}` },
      { status: 500 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `TTS failed: ${message}` },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/chat/tts",
    method: "POST",
    body: { text: "string (truncated to 1000 chars)", voice: "string (default: tongtong)" },
    response: "audio/wav binary (falls back through mp3 → wav → default)",
  });
}
