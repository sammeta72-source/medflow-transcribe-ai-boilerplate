// MedFlow Transcribe AI — FastAPI proxy (catch-all).
// Forwards /api/ai/<path> -> http://localhost:8000/api/<path>
// This makes the AI Agents + DB Connectors + FHIR/HL7 endpoints work whether the
// user accesses the app via the Caddy gateway (port 81) OR the Next.js dev server
// directly (port 3000) — no more "Failed to load" 404s.

import { NextResponse } from "next/server";

const UPSTREAM = "http://localhost:8000/api";

export const dynamic = "force-dynamic";

async function forward(req: Request, pathSegments: string[]) {
  const path = pathSegments.join("/");
  const url = new URL(req.url);
  // Build upstream URL preserving query params (but drop our own route params)
  const upstream = new URL(`${UPSTREAM}/${path}`);
  // Copy through any query params the client sent (except internal ones)
  url.searchParams.forEach((value, key) => {
    upstream.searchParams.append(key, value);
  });

  // Body (for POST/PUT/PATCH)
  let body: BodyInit | undefined = undefined;
  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    try {
      body = await req.text();
    } catch {
      body = undefined;
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const ct = req.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;

  try {
    const upstreamRes = await fetch(upstream.toString(), {
      method,
      headers,
      body,
      cache: "no-store",
      // Don't let Next.js cache the upstream call.
      next: { revalidate: 0 },
    });

    const contentType = upstreamRes.headers.get("content-type") ?? "application/json";
    const responseBody = await upstreamRes.arrayBuffer();
    return new NextResponse(responseBody, {
      status: upstreamRes.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-MedFlow-Upstream": "fastapi-8000",
      },
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json(
      {
        error: "FastAPI upstream unreachable",
        detail: error,
        upstream: `${UPSTREAM}/${path}`,
        hint: "Run: cd mini-services/ai-agents-service && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload",
      },
      { status: 502 },
    );
  }
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
