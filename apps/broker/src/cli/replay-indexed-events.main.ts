import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ReplayIndexedEventsModule } from './replay-indexed-events.module';
import {
  ReplayIndexedEventsRunnerService,
  type ReplayIndexedEventsOptions,
} from './replay-indexed-events.runner';

const logger = new Logger('ReplayIndexedEvents');

function parseIsoDate(label: string, s: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ${label} date: ${s}`);
  }
  return d;
}

function parseArgs(argv: string[]): ReplayIndexedEventsOptions {
  /** pnpm forwards a lone `--` when used as `pnpm run script --`; ignore it. */
  const tokens = argv.filter((a) => a !== '--');

  const out: ReplayIndexedEventsOptions = {
    dryRun: false,
    skip: 0,
    continueOnError: false,
    progressEvery: 100,
  };

  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i];
    if (a === '--dry-run') {
      out.dryRun = true;
    } else if (a === '--continue-on-error') {
      out.continueOnError = true;
    } else if (a.startsWith('--limit=')) {
      out.limit = parseInt(a.slice('--limit='.length), 10);
    } else if (a === '--limit') {
      const v = tokens[++i];
      if (!v) throw new Error('--limit requires a number');
      out.limit = parseInt(v, 10);
    } else if (a.startsWith('--skip=')) {
      out.skip = parseInt(a.slice('--skip='.length), 10);
    } else if (a === '--skip') {
      const v = tokens[++i];
      if (!v) throw new Error('--skip requires a number');
      out.skip = parseInt(v, 10);
    } else if (a.startsWith('--from-id=')) {
      out.fromId = a.slice('--from-id='.length);
    } else if (a === '--from-id') {
      const v = tokens[++i];
      if (!v) throw new Error('--from-id requires a value');
      out.fromId = v;
    } else if (a.startsWith('--after-created-at=')) {
      out.afterCreatedAt = parseIsoDate(
        '--after-created-at',
        a.slice('--after-created-at='.length),
      );
    } else if (a === '--after-created-at') {
      const v = tokens[++i];
      if (!v) throw new Error('--after-created-at requires an ISO-8601 datetime');
      out.afterCreatedAt = parseIsoDate('--after-created-at', v);
    } else if (a.startsWith('--before-created-at=')) {
      out.beforeCreatedAt = parseIsoDate(
        '--before-created-at',
        a.slice('--before-created-at='.length),
      );
    } else if (a === '--before-created-at') {
      const v = tokens[++i];
      if (!v) throw new Error('--before-created-at requires an ISO-8601 datetime');
      out.beforeCreatedAt = parseIsoDate('--before-created-at', v);
    } else if (a.startsWith('--progress-every=')) {
      out.progressEvery = parseInt(a.slice('--progress-every='.length), 10);
    } else if (a === '--progress-every') {
      const v = tokens[++i];
      if (!v) throw new Error('--progress-every requires a number');
      out.progressEvery = parseInt(v, 10);
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${a} (use --help)`);
    }
  }

  if (out.limit !== undefined && (Number.isNaN(out.limit) || out.limit < 0)) {
    throw new Error('--limit must be a non-negative integer');
  }
  if (Number.isNaN(out.skip) || out.skip < 0) {
    throw new Error('--skip must be a non-negative integer');
  }
  if (Number.isNaN(out.progressEvery) || out.progressEvery < 0) {
    throw new Error('--progress-every must be a non-negative integer');
  }

  return out;
}

function printHelp(): void {
  console.log(`
Replay indexed_events through IndexerAggregationService (same path as live RabbitMQ ingestion).

Requires BROKER_DATABASE_URL (or default local DB from broker config).

Usage:
  node dist/cli/replay-indexed-events.main.js [options]

Options:
  --dry-run                 List selection count and up to 5 sample ids; no aggregation
  --skip N                  OFFSET after filters (default 0)
  --limit N                 Max rows to process (optional; omit = all matching rows)
  --from-id ID              Only rows with id >= ID (string comparison on text PK)
  --after-created-at ISO    Only rows with createdAt > this instant (exclusive)
  --before-created-at ISO   Only rows with createdAt <= this instant (inclusive)
  --continue-on-error       Log and continue on aggregation failure (default: abort)
  --progress-every N        Log progress every N rows (default 100; 0 = disable)
  -h, --help                Show this help

Examples:
  pnpm --filter @giwater/broker replay:indexed-events -- --dry-run
  pnpm --filter @giwater/broker replay:indexed-events -- --limit 500
  pnpm --filter @giwater/broker replay:indexed-events -- --after-created-at 2025-01-01T00:00:00Z
`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const app = await NestFactory.createApplicationContext(
    ReplayIndexedEventsModule,
    { logger: ['error', 'warn', 'log'] },
  );

  try {
    const runner = app.get(ReplayIndexedEventsRunnerService);
    const result = await runner.run(options);
    if (!options.dryRun) {
      logger.log(
        `Done: processed=${result.processed} failed=${result.failed} selected=${result.total}`,
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  logger.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
