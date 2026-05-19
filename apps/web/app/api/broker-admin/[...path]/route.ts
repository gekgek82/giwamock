import { NextResponse } from "next/server";

export const runtime = "nodejs";

function upstreamBaseUrl(): string {
  const raw = process.env.BROKER_ADMIN_URL?.trim() || "";
  if (!raw) {
    throw new Error(
      "BROKER_ADMIN_URL is not set. Set it on the Next.js server (not NEXT_PUBLIC).",
    );
  }
  return raw.replace(/\/+$/, "");
}

function joinPath(parts: string[]): string {
  const p = parts.filter(Boolean).join("/");
  return p ? `/${p}` : "/";
}

async function proxy(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const upstreamUrl = `${upstreamBaseUrl()}${joinPath(path)}${new URL(req.url).search}`;

  // Forward headers. Strip hop-by-hop headers.
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const res = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    // Node fetch requires `duplex` when streaming a body.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    duplex: (hasBody ? "half" : undefined) as any,
    body: hasBody ? req.body : undefined,
    redirect: "manual",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return new NextResponse(res.body, {
    status: res.status,
    headers: res.headers,
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function PUT(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function PATCH(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function DELETE(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}

