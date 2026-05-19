import { NextResponse } from "next/server";

export const runtime = "nodejs";

function gatewaySocketUrl(): string {
  const raw = process.env.GATEWAY_HTTP_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "https://gateway.giwater.finance";
}

export function GET() {
  return NextResponse.json({ gatewaySocketUrl: gatewaySocketUrl() });
}
