import { NextResponse } from "next/server";
import type {
  SyncStatus,
  BackfillStatus,
  RebuildStatus,
  RebuildResponse,
  SyncTriggerResponse,
} from "@giwater/shared";

export const runtime = "nodejs";

/** Shape returned by Ponder's built-in GET /status endpoint. */
interface PonderStatusResponse {
  [chainName: string]: {
    id: number;
    block: { number: number; timestamp: number };
  };
}

function indexerBaseUrl(): string | null {
  return process.env.INDEXER_INTERNAL_URL?.trim() || null;
}

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json(
    { statusCode: status, message, error: "IndexerProxyError" },
    { status },
  );
}

async function getSyncStatus(): Promise<NextResponse> {
  const base = indexerBaseUrl();
  if (!base) {
    return jsonError(503, "INDEXER_INTERNAL_URL is not configured");
  }

  let statusData: PonderStatusResponse = {};
  let isSynced = false;

  try {
    const [statusRes, readyRes] = await Promise.allSettled([
      fetch(`${base}/status`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${base}/ready`, { signal: AbortSignal.timeout(5000) }),
    ]);

    if (statusRes.status === "fulfilled" && statusRes.value.ok) {
      statusData = (await statusRes.value.json()) as PonderStatusResponse;
    }
    if (readyRes.status === "fulfilled") {
      isSynced = readyRes.value.ok;
    }
  } catch {
    return jsonError(502, "Failed to reach Ponder indexer");
  }

  const chains = Object.values(statusData);
  const latestBlock = chains.length > 0 ? chains[0]!.block.number : 0;

  const body: SyncStatus = {
    lastBlock: latestBlock,
    currentBlock: latestBlock,
    isSynced,
    blocksRemaining: 0,
  };
  return NextResponse.json(body);
}

function getBackfillStatus(): NextResponse {
  const body: BackfillStatus = { size: 0, isProcessing: false, jobs: [] };
  return NextResponse.json(body);
}

function getRebuildStatus(): NextResponse {
  const body: RebuildStatus = { isRunning: false };
  return NextResponse.json(body);
}

function stubRebuildResponse(): NextResponse {
  const body: RebuildResponse = {
    success: true,
    message: "Not applicable for amm-indexer (Ponder-managed)",
  };
  return NextResponse.json(body);
}

function stubSyncTrigger(): NextResponse {
  const body: SyncTriggerResponse = {
    success: true,
    message: "Ponder manages sync automatically",
  };
  return NextResponse.json(body);
}

type RouteCtx = { params: Promise<{ path: string[] }> };

async function handle(req: Request, ctx: RouteCtx): Promise<NextResponse> {
  const { path } = await ctx.params;
  const [section, action] = path;

  if (section === "sync") {
    if (req.method === "GET" && action === "status") return getSyncStatus();
    if (req.method === "POST" && action === "trigger") return stubSyncTrigger();
    if (req.method === "POST" && action === "reset") return stubSyncTrigger();
  }

  if (section === "backfill") {
    if (req.method === "GET" && action === "status") return getBackfillStatus();
  }

  if (section === "rebuild") {
    if (req.method === "GET" && action === "status") return getRebuildStatus();
    if (req.method === "POST") return stubRebuildResponse();
  }

  return jsonError(404, `Indexer admin route not found: ${path.join("/")}`);
}

export async function GET(req: Request, ctx: RouteCtx) {
  return handle(req, ctx);
}
export async function POST(req: Request, ctx: RouteCtx) {
  return handle(req, ctx);
}
