import { NextResponse } from "next/server";
import { gunzipSync } from "node:zlib";
import { inspect } from "node:util";
import { getMockResponse } from "@/lib/mocks";
import { MOCK_DATA_ENABLED } from "@/lib/config";

export const runtime = "nodejs";

function upstreamBaseUrl(): string {
  // Server-only: do NOT use NEXT_PUBLIC for this.
  const raw = process.env.GATEWAY_HTTP_URL?.trim() || "";
  if (raw) {
    return raw.replace(/\/+$/, "");
  }
  // Default upstream: public gateway origin.
  // Local testing can override via server env `GATEWAY_HTTP_URL=http://localhost:3046`.
  return "https://gateway.giwater.finance";
}

function joinPath(parts: string[]): string {
  const p = parts.filter(Boolean).join("/");
  return p ? `/${p}` : "/";
}

async function proxy(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const pathAndQuery = `${joinPath(path)}${new URL(req.url).search}`;

  if (MOCK_DATA_ENABLED) {
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const body = hasBody ? await req.clone().text() : undefined;
    const mock = getMockResponse({
      method: req.method,
      url: pathAndQuery,
      body,
    });
    if (mock.matched) {
      if (mock.data === undefined) {
        return new NextResponse(null, { status: 204 });
      }
      return NextResponse.json(mock.data);
    }
  }

  const upstreamUrl = `${upstreamBaseUrl()}${joinPath(path)}${new URL(req.url).search}`;
  const isSwapRoutes =
    req.method === "GET" && path.length === 1 && path[0] === "swap-routes";

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  // Avoid compressed (br/gzip) bodies so dev logging is readable.
  // Node fetch can decode gzip/deflate, but brotli can still show up as binary in logs.
  headers.delete("accept-encoding");

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const res = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    duplex: (hasBody ? "half" : undefined) as any,
    body: hasBody ? req.body : undefined,
    redirect: "manual",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  if (process.env.NODE_ENV !== "production" && isSwapRoutes) {
    try {
      const cloned = res.clone();
      const enc = (cloned.headers.get("content-encoding") || "").toLowerCase();
      const buf = Buffer.from(await cloned.arrayBuffer());
      let text = "";
      if (enc.includes("gzip")) {
        text = gunzipSync(buf).toString("utf8");
      } else {
        text = buf.toString("utf8");
      }

      const contentType = cloned.headers.get("content-type") || "";
      const isJsonLike = contentType.includes("application/json") || text.trim().startsWith("{");
      if (isJsonLike) {
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }
        console.log(
          `[gateway-proxy] swap-routes upstream status=${res.status} enc=${enc || "none"}`,
        );
        console.log(`[gateway-proxy] url: ${upstreamUrl}`);
        if (parsed) {
          // Pretty, visual terminal output (colors + full depth).
          console.log(
            inspect(parsed, {
              colors: true,
              depth: null,
              maxArrayLength: 200,
              breakLength: 120,
              compact: false,
            }),
          );
        } else {
          console.log(text);
        }
      } else {
        console.log("[gateway-proxy] swap-routes upstream (non-JSON)", {
          upstreamUrl,
          status: res.status,
          contentEncoding: enc || null,
          contentType,
          body: text.slice(0, 4000),
        });
      }
    } catch (e) {
      console.log("[gateway-proxy] swap-routes log failed", {
        upstreamUrl,
        status: res.status,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const outHeaders = new Headers(res.headers);
  // Node fetch may transparently decode gzip/deflate; never forward encoding headers to the browser.
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
