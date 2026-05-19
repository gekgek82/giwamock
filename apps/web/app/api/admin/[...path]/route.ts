import { NextResponse } from "next/server";

export const runtime = "nodejs";

function upstreamBaseUrl(): string {
  const raw = process.env.ADMIN_API_URL?.trim() || "";
  if (!raw) {
    throw new Error(
      "ADMIN_API_URL is not set. Set it on the Next.js server (not NEXT_PUBLIC).",
    );
  }
  return raw.replace(/\/+$/, "");
}

function joinPath(parts: string[]): string {
  const p = parts.filter(Boolean).join("/");
  return p ? `/${p}` : "/";
}

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json(
    { statusCode: status, message, error: "AdminProxyError" },
    { status },
  );
}

async function proxy(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  let base: string;
  try {
    base = upstreamBaseUrl();
  } catch (e) {
    return jsonError(
      503,
      e instanceof Error ? e.message : "ADMIN_API_URL is not configured",
    );
  }

  const { path } = await ctx.params;
  const search = new URL(req.url).search;
  const joined = joinPath(path);
  const upstreamUrl =
    path[0] === "spot-pairs"
      ? `${base}${joined}${search}`
      : `${base}/admin${joined}${search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  // Prevent upstream from sending compressed responses — Node.js fetch does not
  // decompress brotli/gzip when the body is accessed as a raw stream, so the
  // proxy would forward compressed bytes with the content-encoding header stripped.
  headers.set("accept-encoding", "identity");

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let res: Response;
  try {
    res = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      duplex: (hasBody ? "half" : undefined) as any,
      body: hasBody ? req.body : undefined,
      redirect: "manual",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonError(502, `Upstream admin fetch failed: ${msg}`);
  }

  const outHeaders = new Headers(res.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");
  outHeaders.delete("transfer-encoding");

  return new NextResponse(res.body, {
    status: res.status,
    headers: outHeaders,
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
