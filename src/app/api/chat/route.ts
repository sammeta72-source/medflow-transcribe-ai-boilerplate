// MedFlow AI Operations Copilot — chat completions endpoint (server-side only).
// Uses z-ai-web-dev-sdk (server-side singleton via ZAI.create()).
//
// POST body: { messages: Array<{role, content}>, systemPrompt?: string }
// Response:  { content: string, usage?: Record<string, unknown> }

import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MEDFLOW_SYSTEM_PROMPT =
  "You are the MedFlow AI Operations Copilot, an assistant for medical transcription BPO operations managers. " +
  "You can: explain the workflow, summarize job status, recommend SLA actions, and trigger AI agents. " +
  "When the user asks to run an agent, respond that you've triggered it and summarize the result. " +
  "Be concise (2-4 sentences). Never claim a document is clinically final — humans always approve.";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  messages?: ChatMessage[];
  systemPrompt?: string;
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const userMessages = Array.isArray(body.messages) ? body.messages : [];
  if (userMessages.length === 0) {
    return NextResponse.json(
      { error: "messages[] is required" },
      { status: 400 },
    );
  }

  // Sanitize messages — keep only well-formed entries, drop empty/system duplicates.
  const cleaned: ChatMessage[] = userMessages
    .filter((m) => m && typeof m.role === "string" && typeof m.content === "string" && m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));

  if (cleaned.length === 0) {
    return NextResponse.json(
      { error: "No non-empty messages" },
      { status: 400 },
    );
  }

  const systemPrompt =
    typeof body.systemPrompt === "string" && body.systemPrompt.trim().length > 0
      ? body.systemPrompt
      : DEFAULT_MEDFLOW_SYSTEM_PROMPT;

  try {
    const zai = await ZAI.create();

    // The SDK only accepts 'system' | 'user' | 'assistant' roles. If the
    // caller sent a leading 'system' message, prefer the explicit systemPrompt
    // (or default) so we don't end up with two system messages.
    const filtered = cleaned.filter((m) => m.role !== "system");

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...filtered.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      thinking: { type: "disabled" },
    });

    // The SDK returns the raw OpenAI-style completion object. Pull the content
    // from the first choice's message; fall back gracefully if shape differs.
    const choice = completion?.choices?.[0];
    const content: string | undefined =
      choice?.message?.content ??
      choice?.delta?.content ??
      (typeof completion?.content === "string" ? completion.content : undefined);

    const usage = completion?.usage ?? undefined;

    if (!content) {
      return NextResponse.json(
        { error: "Empty completion from model", raw: JSON.stringify(completion).slice(0, 400) },
        { status: 502 },
      );
    }

    return NextResponse.json({ content, usage });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Chat completion failed: ${message}` },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/chat",
    method: "POST",
    body: { messages: "Array<{role, content}>", systemPrompt: "string (optional)" },
  });
}
