import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) {
    return NextResponse.json(
      { error: "SITE_PASSWORD is not configured on the server" },
      { status: 503 },
    );
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (body.password !== sitePassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
