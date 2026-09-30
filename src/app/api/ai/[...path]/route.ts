// MedFlow Transcribe AI — FastAPI proxy (catch-all).
// Forwards /api/ai/<path> -> http://localhost:8000/api/<path>
// This makes the AI Agents + DB Connectors + FHIR/HL7 endpoints work whether the
// user accesses the app via the Caddy gateway (port 81) OR the Next.js dev server
// directly (port 3000) — no more "Failed to load" 404s.
//
// Resilience: retries transient upstream failures (max 3 attempts, 10s timeout
// each) so a momentarily-slow FastAPI service doesn't surface as a 502 to the UI.

import { NextResponse } from "next/server";

const UPSTREAM = "http://localhost:8000/api";
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 400;
const UPSTREAM_TIMEOUT_MS = 10_000;

export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function forward(req: Request, pathSegments: string[]) {
  const path = pathSegments.join("/");
  const url = new URL(req.url);
  // Build upstream URL preserving query params (but drop our own route params)
  const upstream = new URL(`${UPSTREAM}/${path}`);
  url.searchParams.forEach((value, key) => {
    upstream.searchParams.append(key, value);
  });

  // Read the body ONCE (for retries we need to re-send it each attempt)
  const method = req.method.toUpperCase();
  let bodyText: string | null = null;
  if (method !== "GET" && method !== "HEAD") {
    try {
      bodyText = await req.text();
    } catch {
      bodyText = null;
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const ct = req.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;

  let lastError: string = "unknown error";
  let lastStatus = 502;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const upstreamRes = await fetch(upstream.toString(), {
        method,
        headers,
        body: bodyText ?? undefined,
        cache: "no-store",
        // Don't let Next.js cache the upstream call.
        next: { revalidate: 0 },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = upstreamRes.headers.get("content-type") ?? "application/json";
      const responseBody = await upstreamRes.arrayBuffer();
      return new NextResponse(responseBody, {
        status: upstreamRes.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-store",
          "X-MedFlow-Upstream": "fastapi-8000",
          "X-MedFlow-Attempt": String(attempt),
        },
      });
    } catch (e) {
      clearTimeout(timeout);
      const isAbort = e instanceof Error && e.name === "AbortError";
      lastError = e instanceof Error ? e.message : "unknown error";
      lastStatus = isAbort ? 504 : 502;
      // Only retry on transient errors (timeout / connection refused). If the
      // upstream returned a real HTTP error, we wouldn't be in the catch.
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt); // linear backoff
      }
    }
  }

  // All attempts failed — return a helpful 502/504 envelope.
  return NextResponse.json(
    {
      error: "FastAPI upstream unreachable",
      detail: lastError,
      upstream: `${UPSTREAM}/${path}`,
      attempts: MAX_ATTEMPTS,
      hint: "The Python FastAI service on :8000 may be restarting. It will auto-recover. Run: cd mini-services/ai-agents-service && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload",
    },
    { status: lastStatus },
  );
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function PUT(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}
