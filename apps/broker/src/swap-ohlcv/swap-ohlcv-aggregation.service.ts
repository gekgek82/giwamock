import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { effectiveErc20Decimals, type SwapIndexerBrokerPayload } from '@giwater/shared';
import type { EntityManager } from 'typeorm';
import { In, Repository } from 'typeorm';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';
import { SpotPairTimeBucketEntity } from '../models/pair/spot-pair-time-bucket.entity';
import { SpotTokenEntity } from '../models/token/spot-token.entity';
import { SpotTokenTimeBucketEntity } from '../models/token/spot-token-time-bucket.entity';
import { SwapBucketStateEntity } from '../models/swap/swap-bucket-state.entity';
import { SwapLiquidityEdgeEntity } from '../models/swap/swap-liquidity-edge.entity';
import { AccountNotificationService } from '../account-notifications/account-notification.service';
import { ExchangeRollupService } from '../exchange/exchange-rollup.service';
import { DexUsdQuoteService } from '../pricing/dex-usd-quote.service';
import {
  bigintToUiDouble,
  parseWireBigInt,
} from './bigint-for-ui';
import {
  alignBucketStart,
  bucketEndExclusive,
  nextBucketStart,
  SWAP_BUCKET_RESOLUTIONS,
  type SwapBucketResolution,
} from './swap-bucket-resolution';
import type { BrokerConfig } from '../config/configuration';
import { rollSpotPairUtcDayWindow } from '../utils/spot-pair-utc-day-roll';
import { rollSpotTokenUtcDayWindow } from '../utils/spot-token-utc-day-roll';

const MAX_GAP_STEPS = 5000;

function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

/** `42P01` — queried relation/table does not exist (wrong DB, migrations not applied, etc.). */
function isPgUndefinedTable(err: unknown): boolean {
  const e = err as { code?: string; driverError?: { code?: string } };
  return e?.code === '42P01' || e?.driverError?.code === '42P01';
}

/** Transient pool/network failures — avoid crashing the Nest scheduler every minute. */
function isDbConnectTimeout(err: unknown): boolean {
  const e = err as { code?: string; name?: string; errors?: unknown[] };
  if (e?.code === 'ETIMEDOUT') return true;
  if (e?.name === 'AggregateError' && Array.isArray(e.errors)) {
    return e.errors.some((x) => isDbConnectTimeout(x));
  }
  return false;
}

function lc(s: string): string {
  return s.toLowerCase();
}

function ohlcDiffFromOpenClose(open: number, close: number): {
  diff: number;
  pct: number;
} {
  const diff = close - open;
  const pct =
    open !== 0 && Number.isFinite(open) && Number.isFinite(close)
      ? (100 * diff) / open
      : 0;
  return { diff, pct };
}

@Injectable()
export class SwapOhlcvAggregationService {
  private readonly logger = new Logger(SwapOhlcvAggregationService.name);

  /** Last full-table BF scan (`syncSpotTokenBfFieldsFromTimeBuckets`), for orphan rows. */
  private lastSpotTokenBfFullScanAt = 0;

  /** Log schema-missing warning once per process (minute cron would spam otherwise). */
  private ohlcvWallClockSchemaWarned = false;

  constructor(
    @InjectRepository(SpotPairTimeBucketEntity)
    private readonly pairBucketRepo: Repository<SpotPairTimeBucketEntity>,
    @InjectRepository(SpotTokenTimeBucketEntity)
    private readonly tokenBucketRepo: Repository<SpotTokenTimeBucketEntity>,
    @InjectRepository(SwapBucketStateEntity)
    private readonly stateRepo: Repository<SwapBucketStateEntity>,
    @InjectRepository(SwapLiquidityEdgeEntity)
    private readonly edgeRepo: Repository<SwapLiquidityEdgeEntity>,
    @InjectRepository(SpotPairEntity)
    private readonly spotPairRepo: Repository<SpotPairEntity>,
    @InjectRepository(SpotTokenEntity)
    private readonly spotTokenRepo: Repository<SpotTokenEntity>,
    private readonly dexUsdQuote: DexUsdQuoteService,
    private readonly exchangeRollup: ExchangeRollupService,
    private readonly accountNotifications: AccountNotificationService,
    private readonly configService: ConfigService,
  ) {}

  async onSwap(payload: SwapIndexerBrokerPayload): Promise<{ pool: string | null }> {
    const blockTs = bigintToUiDouble(
      parseWireBigInt(payload.blockTimestamp),
      undefined,
      'swap.blockTimestamp',
    );
    const tokenIn = lc(payload.tokenIn);
    const tokenOut = lc(payload.tokenOut);
    const pool = await this.resolvePoolForTokens(tokenIn, tokenOut);
    if (!pool) {
      this.logger.warn(
        `Swap OHLCV: no pool edge for tokens in=${tokenIn} out=${tokenOut} id=${payload.id}`,
      );
      await this.tokenBucketsOnly(payload, blockTs);
      await this.syncSpotTokenBfFieldsForTokenIds(
        [tokenIn, tokenOut],
        Math.floor(Date.now() / 1000),
      );
      await this.refreshSpotTokenProfilesOnly(payload, blockTs);
      return { pool: null };
    }
    const edge = await this.edgeRepo.findOne({ where: { poolAddress: pool } });
    const base = lc(edge?.token0 ?? '');
    const quote = lc(edge?.token1 ?? '');
    const symbol = '';

    const usdByToken = await this.dexUsdQuote.resolveUsdPricesForTokens([
      base,
      quote,
      tokenIn,
      tokenOut,
    ]);

    await this.pairBucketRepo.manager.transaction(async (em) => {
      for (const resolution of SWAP_BUCKET_RESOLUTIONS) {
        await this.advancePairBuckets(
          em,
          pool,
          resolution,
          blockTs,
          base,
          quote,
          symbol,
          payload,
          usdByToken,
        );
      }
    });

    await this.tokenBucketRepo.manager.transaction(async (em) => {
      for (const resolution of SWAP_BUCKET_RESOLUTIONS) {
        await this.advanceTokenBuckets(
          em,
          tokenIn,
          resolution,
          blockTs,
          payload,
          'in',
          usdByToken,
        );
        await this.advanceTokenBuckets(
          em,
          tokenOut,
          resolution,
          blockTs,
          payload,
          'out',
          usdByToken,
        );
      }
    });

    await this.syncSpotTokenBfFieldsForTokenIds(
      [tokenIn, tokenOut],
      Math.floor(Date.now() / 1000),
    );

    await this.refreshSpotPairAndTokenProfiles(
      pool,
      base,
      quote,
      edge,
      payload,
      blockTs,
      usdByToken,
    );

    this.logger.log(
      `Swap OHLCV: applied id=${payload.id} pool=${pool} ${tokenIn}->${tokenOut}`,
    );
    return { pool };
  }

  /**
   * Cron: ensure current UTC-aligned windows exist even with zero swaps (flat carry).
   * Catches missing-schema / DB timeouts so `@Cron` does not emit unhandled errors every minute.
   */
  async ensureWallClockBuckets(): Promise<void> {
    try {
      await this.runEnsureWallClockBuckets();
    } catch (err: unknown) {
      if (isPgUndefinedTable(err)) {
        if (!this.ohlcvWallClockSchemaWarned) {
          this.ohlcvWallClockSchemaWarned = true;
          this.logger.warn(
            'OHLCV wall-clock cron skipped: broker tables are missing (e.g. spot_pairs). Point BROKER_DATABASE_URL / DATABASE_URL at the broker Postgres where schema exists (TypeORM synchronize on startup), or set DISABLE_BROKER_OHLCV_CRON=true until the DB is ready.',
          );
        }
        return;
      }
      if (isDbConnectTimeout(err)) {
        this.logger.warn(
          'OHLCV wall-clock cron skipped: database connection timed out.',
        );
        return;
      }
      throw err;
    }
  }

  private async runEnsureWallClockBuckets(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    // Prefer `spot_pairs` as the pool/base/quote source of truth so wall-clock
    // buckets exist even if `swap_liquidity_edges` is missing or lagging.
    const pairRows = await this.spotPairRepo.find({
      select: ['id', 'base', 'quote', 'symbol'],
    });
    const pairMap = new Map(
      pairRows.map((p) => [
        lc(p.id),
        { base: lc(p.base ?? ''), quote: lc(p.quote ?? ''), symbol: p.symbol ?? '' },
      ]),
    );

    const edgePools = await this.edgeRepo
      .createQueryBuilder('e')
      .select('DISTINCT e.poolAddress', 'pool')
      .getRawMany<{ pool: string }>();

    const poolIds = new Set<string>([
      ...pairMap.keys(),
      ...edgePools.map((r) => lc(r.pool)),
    ]);

    for (const pool of poolIds) {
      const fromPairs = pairMap.get(pool);
      const edge = fromPairs
        ? null
        : await this.edgeRepo.findOne({ where: { poolAddress: pool } });
      const base = fromPairs?.base ?? lc(edge?.token0 ?? '');
      const quote = fromPairs?.quote ?? lc(edge?.token1 ?? '');
      const symbol = fromPairs?.symbol ?? '';
      await this.pairBucketRepo.manager.transaction(async (em) => {
        for (const resolution of SWAP_BUCKET_RESOLUTIONS) {
          await this.advancePairBuckets(
            em,
            pool,
            resolution,
            now,
            base,
            quote,
            symbol,
            null,
          );
        }
      });
    }

    const tokenSet = new Set<string>();
    for (const row of await this.edgeRepo
      .createQueryBuilder('e')
      .select('DISTINCT e.token0', 't')
      .getRawMany<{ t: string }>()) {
      tokenSet.add(lc(row.t));
    }
    for (const row of await this.edgeRepo
      .createQueryBuilder('e')
      .select('DISTINCT e.token1', 't')
      .getRawMany<{ t: string }>()) {
      tokenSet.add(lc(row.t));
    }

    for (const tok of tokenSet) {
      await this.tokenBucketRepo.manager.transaction(async (em) => {
        for (const resolution of SWAP_BUCKET_RESOLUTIONS) {
          await this.advanceTokenBuckets(em, tok, resolution, now, null, 'in');
        }
      });
    }

    // Exchange-wide buckets (spot_exchange_time_buckets) should also exist on wall clock.
    await this.exchangeRollup.ensureWallClockBuckets({ nowSec: now });

    await this.syncSpotTokenBfFieldsForTokenIds([...tokenSet], now);
    await this.syncSpotTokenProfileMetricsFromTimeBuckets([...tokenSet], now);

    if (this.shouldRunSpotTokenBfFullScan(now)) {
      await this.syncSpotTokenBfFieldsFromTimeBuckets(now);
      this.lastSpotTokenBfFullScanAt = now;
    }
  }

  /**
   * Latest **completed** bucket per token at `resolution`: max `bucketStartTs` strictly before the
   * **current** window start `alignBucketStart(nowSec, resolution)`. Matches what wall-clock cron materializes.
   */
  private async priorBucketCloseMap(
    ids: string[],
    resolution: SwapBucketResolution,
    nowSec: number,
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (ids.length === 0) {
      return out;
    }
    const windowStart = alignBucketStart(nowSec, resolution);
    const peakRows = await this.tokenBucketRepo
      .createQueryBuilder('b')
      .select('b.token', 'token')
      .addSelect('MAX(b.bucketStartTs)', 'mx')
      .where('b.resolution = :resolution', { resolution })
      .andWhere('b.token IN (:...ids)', { ids })
      .andWhere('b.bucketStartTs < :w', { w: windowStart })
      .groupBy('b.token')
      .getRawMany<{ token: string; mx: string | number }>();

    const peaks = peakRows
      .map((r) => ({
        token: r.token,
        mx: typeof r.mx === 'string' ? parseFloat(r.mx) : r.mx,
      }))
      .filter((p) => Number.isFinite(p.mx));

    if (peaks.length === 0) {
      return out;
    }

    const params: Record<string, string | number> = { resolution };
    const parts: string[] = [];
    peaks.forEach((p, i) => {
      parts.push(`(b.token = :tok${i} AND b.bucketStartTs = :mx${i})`);
      params[`tok${i}`] = p.token;
      params[`mx${i}`] = p.mx;
    });

    const rows = await this.tokenBucketRepo
      .createQueryBuilder('b')
      .where(`b.resolution = :resolution AND (${parts.join(' OR ')})`, params)
      .getMany();

    for (const r of rows) {
      if (
        Number.isFinite(r.close) &&
        r.close > 0 &&
        r.close !== Number.POSITIVE_INFINITY
      ) {
        out.set(lc(r.token), r.close);
      }
    }
    return out;
  }

  /**
   * Copies lookback bucket closes into **`spot_tokens`** for the given ids (chunked).
   * Called right after token OHLCV buckets are advanced for those tokens.
   */
  private async syncSpotTokenBfFieldsForTokenIds(
    rawIds: string[],
    nowSec: number,
  ): Promise<void> {
    if (process.env.DISABLE_SPOT_TOKEN_BF_SYNC === 'true') {
      return;
    }
    const uniq = [...new Set(rawIds.map((x) => lc(x)).filter((x) => x.length > 0))];
    if (uniq.length === 0) {
      return;
    }
    const chunkSize = Math.min(
      2000,
      Math.max(50, Number(process.env.SPOT_TOKEN_BF_SYNC_BATCH ?? '400')),
    );
    for (let i = 0; i < uniq.length; i += chunkSize) {
      await this.flushBfFieldsForTokenChunk(uniq.slice(i, i + chunkSize), nowSec);
    }
  }

  private async flushBfFieldsForTokenChunk(
    ids: string[],
    nowSec: number,
  ): Promise<number> {
    const [m1h, m1d, m1w, m1mo] = await Promise.all([
      this.priorBucketCloseMap(ids, '1h', nowSec),
      this.priorBucketCloseMap(ids, '1d', nowSec),
      this.priorBucketCloseMap(ids, '1w', nowSec),
      this.priorBucketCloseMap(ids, '1mo', nowSec),
    ]);

    const tokens = await this.spotTokenRepo.find({ where: { id: In(ids) } });
    const toSave: SpotTokenEntity[] = [];
    for (const row of tokens) {
      const id = lc(row.id);
      let changed = false;
      const useClose = (v: number | undefined, assign: (n: number) => void) => {
        if (
          v !== undefined &&
          Number.isFinite(v) &&
          v > 0 &&
          v !== Number.POSITIVE_INFINITY
        ) {
          assign(v);
          changed = true;
        }
      };
      useClose(m1h.get(id), (n) => {
        row.priceUSD1HourBF = n;
      });
      useClose(m1d.get(id), (n) => {
        row.priceUSD1DayBF = n;
      });
      useClose(m1w.get(id), (n) => {
        row.priceUSD1WeekBF = n;
      });
      useClose(m1mo.get(id), (n) => {
        row.priceUSD1MonthBF = n;
      });
      if (changed) {
        toSave.push(row);
      }
    }
    if (toSave.length > 0) {
      await this.spotTokenRepo.save(toSave);
    }
    return toSave.length;
  }

  /**
   * After wall-clock buckets advance, copy **`spot_token_time_buckets`** OHLC / volume into
   * **`spot_tokens`** day / hour / week / month fields (and UTC-day roll + bucket-backed day stats).
   * Does not overwrite **`dayTvl` / `dayTvlUSD`** (liquidity mint path); those reset only on UTC day roll.
   */
  private async syncSpotTokenProfileMetricsFromTimeBuckets(
    rawIds: string[],
    nowSec: number,
  ): Promise<void> {
    const uniq = [...new Set(rawIds.map((x) => lc(x)).filter((x) => x.length > 0))];
    if (uniq.length === 0) {
      return;
    }
    const chunkSize = Math.min(
      2000,
      Math.max(50, Number(process.env.SPOT_TOKEN_BF_SYNC_BATCH ?? '400')),
    );
    for (let i = 0; i < uniq.length; i += chunkSize) {
      await this.flushSpotTokenProfileMetricsChunk(uniq.slice(i, i + chunkSize), nowSec);
    }
  }

  private async flushSpotTokenProfileMetricsChunk(
    ids: string[],
    nowSec: number,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const w1h = alignBucketStart(nowSec, '1h');
    const w1d = alignBucketStart(nowSec, '1d');
    const w1w = alignBucketStart(nowSec, '1w');
    const w1mo = alignBucketStart(nowSec, '1mo');

    const buckets = await this.tokenBucketRepo
      .createQueryBuilder('b')
      .where('b.token IN (:...ids)', { ids })
      .andWhere(
        '(b.resolution = :h AND b.bucketStartTs = :wh) OR (b.resolution = :d AND b.bucketStartTs = :wd) OR (b.resolution = :w AND b.bucketStartTs = :ww) OR (b.resolution = :mo AND b.bucketStartTs = :wmo)',
        {
          h: '1h',
          wh: w1h,
          d: '1d',
          wd: w1d,
          w: '1w',
          ww: w1w,
          mo: '1mo',
          wmo: w1mo,
        },
      )
      .getMany();

    const key = (token: string, resolution: string) => `${lc(token)}|${resolution}`;
    const byKey = new Map<string, SpotTokenTimeBucketEntity>();
    for (const b of buckets) {
      byKey.set(key(b.token, b.resolution), b);
    }

    const rows = await this.spotTokenRepo.find({ where: { id: In(ids) } });
    const toSave: SpotTokenEntity[] = [];

    for (const row of rows) {
      const id = lc(row.id);
      let changed = false;

      const metricsDayBefore = row.metricsDayStartTs;
      rollSpotTokenUtcDayWindow(row, w1d);
      if (row.metricsDayStartTs !== metricsDayBefore) {
        changed = true;
      }

      const b1d = byKey.get(key(id, '1d'));
      if (b1d) {
        row.dayHigh = b1d.high;
        row.dayLow = b1d.low;
        row.dayVolume = b1d.volume;
        row.dayVolumeUSD = b1d.volumeUSD ?? 0;
        const d1 = ohlcDiffFromOpenClose(b1d.open, b1d.close);
        row.dayPriceDifference = d1.diff;
        row.dayPriceDifferencePercentage = d1.pct;
        row.metricsDayStartTs = w1d;
        changed = true;
      }

      const b1h = byKey.get(key(id, '1h'));
      if (b1h) {
        const dh = ohlcDiffFromOpenClose(b1h.open, b1h.close);
        row.hourPriceDifference = dh.diff;
        row.hourPriceDifferencePercentage = dh.pct;
        changed = true;
      }

      const bw = byKey.get(key(id, '1w'));
      if (bw) {
        const dw = ohlcDiffFromOpenClose(bw.open, bw.close);
        row.weekPriceDifference = dw.diff;
        row.weekPriceDifferencePercentage = dw.pct;
        changed = true;
      }

      const bmo = byKey.get(key(id, '1mo'));
      if (bmo) {
        const dmo = ohlcDiffFromOpenClose(bmo.open, bmo.close);
        row.monthPriceDifference = dmo.diff;
        row.monthPriceDifferencePercentage = dmo.pct;
        changed = true;
      }

      if (changed) {
        toSave.push(row);
      }
    }

    if (toSave.length > 0) {
      await this.spotTokenRepo.save(toSave);
    }
  }

  /**
   * Full **`spot_tokens`** scan (CLI / orphan repair). Prefer **`syncSpotTokenBfFieldsForTokenIds`**
   * on the hot path after buckets change.
   *
   * Bucket closes follow swap-implied ratio units from token bucket merges; they are **not**
   * recomputed as USD when `DexUsdQuoteService` routes — keep that in mind vs live `priceUSD`.
   *
   * Env: **`DISABLE_SPOT_TOKEN_BF_SYNC`**, **`SPOT_TOKEN_BF_SYNC_BATCH`**, **`SPOT_TOKEN_BF_FULL_SCAN_INTERVAL_SEC`** — see broker README.
   */
  async syncSpotTokenBfFieldsFromTimeBuckets(nowSec?: number): Promise<void> {
    if (process.env.DISABLE_SPOT_TOKEN_BF_SYNC === 'true') {
      return;
    }
    const now = nowSec ?? Math.floor(Date.now() / 1000);

    const batchSize = Math.min(
      2000,
      Math.max(50, Number(process.env.SPOT_TOKEN_BF_SYNC_BATCH ?? '400')),
    );

    let lastId: string | null = null;
    let totalRows = 0;
    let totalSaved = 0;
    const t0 = Date.now();

    for (;;) {
      const qb = this.spotTokenRepo
        .createQueryBuilder('t')
        .select('t.id')
        .orderBy('t.id', 'ASC')
        .take(batchSize);
      if (lastId) {
        qb.andWhere('t.id > :lastId', { lastId });
      }
      const idRows = await qb.getMany();
      if (idRows.length === 0) {
        break;
      }
      const ids = idRows.map((r) => r.id);
      lastId = ids[ids.length - 1] ?? null;

      totalSaved += await this.flushBfFieldsForTokenChunk(ids, now);
      totalRows += ids.length;
    }

    const ms = Date.now() - t0;
    this.logger.log(
      `spot_tokens BF full scan: scanned ${totalRows} ids, saved ${totalSaved} rows in ${ms}ms`,
    );
  }

  /** Periodic full-table pass for tokens without graph edges (otherwise BF updates inline after buckets). */
  private shouldRunSpotTokenBfFullScan(now: number): boolean {
    if (process.env.DISABLE_SPOT_TOKEN_BF_SYNC === 'true') {
      return false;
    }
    const interval = Number(process.env.SPOT_TOKEN_BF_FULL_SCAN_INTERVAL_SEC ?? '3600');
    if (!Number.isFinite(interval) || interval <= 0) {
      return false;
    }
    if (
      this.lastSpotTokenBfFullScanAt !== 0 &&
      now - this.lastSpotTokenBfFullScanAt < interval
    ) {
      return false;
    }
    return true;
  }

  private async tokenBucketsOnly(
    payload: SwapIndexerBrokerPayload,
    blockTs: number,
  ): Promise<void> {
    const tokenIn = lc(payload.tokenIn);
    const tokenOut = lc(payload.tokenOut);
    const usdByToken = await this.dexUsdQuote.resolveUsdPricesForTokens([
      tokenIn,
      tokenOut,
      lc(payload.feeToken),
    ]);
    await this.tokenBucketRepo.manager.transaction(async (em) => {
      for (const resolution of SWAP_BUCKET_RESOLUTIONS) {
        await this.advanceTokenBuckets(
          em,
          tokenIn,
          resolution,
          blockTs,
          payload,
          'in',
          usdByToken,
        );
        await this.advanceTokenBuckets(
          em,
          tokenOut,
          resolution,
          blockTs,
          payload,
          'out',
          usdByToken,
        );
      }
    });
  }

  /**
   * Updates `spot_pairs` last price + UTC-day base/quote volumes and OHLC hints,
   * swap fee USD accumulators (`totalSwapFeesUsd`, `daySwapFeesUsd`), and `spot_tokens` price
   * (`priceUSD`: DEX-routed USD when configured, else swap-implied ratio),
   * day volume (+ `dayVolumeUSD` when USD route exists), and trade count.
   */
  private async refreshSpotPairAndTokenProfiles(
    pool: string,
    edgeBase: string,
    edgeQuote: string,
    edge: SwapLiquidityEdgeEntity | null,
    payload: SwapIndexerBrokerPayload,
    blockTs: number,
    usdByToken: ReadonlyMap<string, number | null>,
  ): Promise<void> {
    let pair = await this.spotPairRepo.findOne({ where: { id: pool } });
    const e0 = lc(edgeBase);
    const e1 = lc(edgeQuote);
    const hasDisplayOrientation =
      pair &&
      typeof pair.base === 'string' &&
      pair.base.trim() !== '' &&
      typeof pair.quote === 'string' &&
      pair.quote.trim() !== '';
    /** Display base/quote from PoolCreated/indexer when present; else canonical edge token0/token1. */
    const base = hasDisplayOrientation ? lc(pair!.base) : e0;
    const quote = hasDisplayOrientation ? lc(pair!.quote) : e1;

    const dayKey = alignBucketStart(blockTs, '1d');
    const px = await this.pairPrice(payload, base, quote);
    const { bv, qv } = this.pairVolumes(payload, base, quote);
    const feeUsd = await this.estimateSwapFeeUsd(usdByToken, payload);

    if (!pair) {
      pair = this.spotPairRepo.create({
        id: pool,
        base: e0,
        quote: e1,
        isConcentratedLiquidity: Boolean(edge?.isConcentratedLiquidity),
        type: edge?.stable ? 'stable' : 'volatile',
        exchange: 'giwater',
        listed: false,
      });
    }
    if (edge) {
      pair.token0 = lc(edge.token0);
      pair.token1 = lc(edge.token1);
    }
    this.rollSpotPairDayWindow(pair, dayKey);
    if (pair.dayOpen === 0) {
      pair.dayOpen = px;
      pair.dayHigh = px;
      pair.dayLow = px;
    } else {
      pair.dayHigh = Math.max(pair.dayHigh, px);
      pair.dayLow = pair.dayLow === 0 ? px : Math.min(pair.dayLow, px);
    }
    pair.price = px;
    pair.dayBaseVolume += bv;
    pair.dayQuoteVolume += qv;
    const usdB = usdByToken.get(lc(base));
    const usdQ = usdByToken.get(lc(quote));
    if (usdB !== null && usdB !== undefined && Number.isFinite(usdB)) {
      pair.dayBaseVolumeUSD += bv * usdB;
    }
    if (usdQ !== null && usdQ !== undefined && Number.isFinite(usdQ)) {
      pair.dayQuoteVolumeUSD += qv * usdQ;
    }
    pair.dayPriceDifference = px - pair.dayOpen;
    pair.dayPriceDifferencePercentage =
      pair.dayOpen !== 0 ? (100 * (px - pair.dayOpen)) / pair.dayOpen : 0;
    pair.ath = pair.ath === 0 ? px : Math.max(pair.ath, px);
    pair.atl = pair.atl === 0 ? px : Math.min(pair.atl, px);

    if (Number.isFinite(feeUsd) && feeUsd > 0) {
      pair.totalSwapFeesUsd = (pair.totalSwapFeesUsd ?? 0) + feeUsd;
      pair.daySwapFeesUsd = (pair.daySwapFeesUsd ?? 0) + feeUsd;
    }

    const volUsd =
      (usdB !== null && usdB !== undefined && Number.isFinite(usdB) ? bv * usdB : 0) +
      (usdQ !== null && usdQ !== undefined && Number.isFinite(usdQ) ? qv * usdQ : 0);

    await this.spotPairRepo.save(pair);

    await this.mergeSpotTokenProfileRow(
      lc(payload.tokenIn),
      'in',
      payload,
      blockTs,
      usdByToken,
    );
    await this.mergeSpotTokenProfileRow(
      lc(payload.tokenOut),
      'out',
      payload,
      blockTs,
      usdByToken,
    );

    await this.exchangeRollup.recordSwapVolumeAndTrade({
      blockTs,
      volumeUsd: volUsd,
      feeUsd,
    });

    await this.accountNotifications.recordSwap({
      payload,
      blockTsSec: blockTs,
      volumeUsd: volUsd,
    });
  }

  private async refreshSpotTokenProfilesOnly(
    payload: SwapIndexerBrokerPayload,
    blockTs: number,
  ): Promise<void> {
    const usdByToken = await this.dexUsdQuote.resolveUsdPricesForTokens([
      lc(payload.tokenIn),
      lc(payload.tokenOut),
      lc(payload.feeToken),
    ]);
    await this.mergeSpotTokenProfileRow(
      lc(payload.tokenIn),
      'in',
      payload,
      blockTs,
      usdByToken,
    );
    await this.mergeSpotTokenProfileRow(
      lc(payload.tokenOut),
      'out',
      payload,
      blockTs,
      usdByToken,
    );

    const volUsd = this.estimateSwapVolumeUsd(usdByToken, payload);
    const feeUsd = await this.estimateSwapFeeUsd(usdByToken, payload);
    await this.exchangeRollup.recordSwapVolumeAndTrade({
      blockTs,
      volumeUsd: volUsd,
      feeUsd,
    });

    await this.accountNotifications.recordSwap({
      payload,
      blockTsSec: blockTs,
      volumeUsd: volUsd,
    });
  }

  private estimateSwapVolumeUsd(
    usdByToken: ReadonlyMap<string, number | null>,
    payload: SwapIndexerBrokerPayload,
  ): number {
    const tin = lc(payload.tokenIn);
    const tout = lc(payload.tokenOut);
    const warn = (m: string) => this.logger.debug(m);
    const ai = bigintToUiDouble(
      parseWireBigInt(payload.amountIn),
      warn,
      'swap.amountIn',
    );
    const ao = bigintToUiDouble(
      parseWireBigInt(payload.amountOut),
      warn,
      'swap.amountOut',
    );
    const uIn = usdByToken.get(tin);
    const uOut = usdByToken.get(tout);
    const legIn =
      uIn !== null && uIn !== undefined && Number.isFinite(uIn) ? ai * uIn : 0;
    const legOut =
      uOut !== null && uOut !== undefined && Number.isFinite(uOut) ? ao * uOut : 0;
    if (legIn > 0 && legOut > 0) return Math.min(legIn, legOut);
    return legIn + legOut;
  }

  private async estimateSwapFeeUsd(
    usdByToken: ReadonlyMap<string, number | null>,
    payload: SwapIndexerBrokerPayload,
  ): Promise<number> {
    const feeToken = lc(payload.feeToken);
    const usd = usdByToken.get(feeToken);
    if (usd === null || usd === undefined || !Number.isFinite(usd) || usd < 0) return 0;
    const feeWei = parseWireBigInt(payload.feeAmount);
    const dec = await this.resolveTokenDecimals(feeToken);
    const feeUi = this.weiToUiDouble(feeWei, dec);
    const feeUsd = feeUi * usd;
    return Number.isFinite(feeUsd) ? feeUsd : 0;
  }

  private rollSpotPairDayWindow(pair: SpotPairEntity, dayKey: number): void {
    rollSpotPairUtcDayWindow(pair, dayKey);
  }

  private rollSpotTokenDayWindow(row: SpotTokenEntity, dayKey: number): void {
    rollSpotTokenUtcDayWindow(row, dayKey);
  }

  private async mergeSpotTokenProfileRow(
    token: string,
    leg: 'in' | 'out',
    payload: SwapIndexerBrokerPayload,
    blockTs: number,
    usdByToken: ReadonlyMap<string, number | null>,
  ): Promise<void> {
    const dayKey = alignBucketStart(blockTs, '1d');
    const warn = (m: string) => this.logger.debug(m);
    const vol =
      leg === 'in'
        ? bigintToUiDouble(
            parseWireBigInt(payload.amountIn),
            warn,
            'swap.amountIn',
          )
        : bigintToUiDouble(
            parseWireBigInt(payload.amountOut),
            warn,
            'swap.amountOut',
          );
    const r = this.swapPriceAmountRatio(payload);
    const implied = leg === 'in' ? r : r === 0 ? 0 : 1 / r;

    let row = await this.spotTokenRepo.findOne({ where: { id: token } });
    if (!row) {
      row = this.spotTokenRepo.create({ id: token, listed: false });
    }
    this.rollSpotTokenDayWindow(row, dayKey);
    row.dayHigh = row.dayHigh === 0 ? implied : Math.max(row.dayHigh, implied);
    row.dayLow = row.dayLow === 0 ? implied : Math.min(row.dayLow, implied);
    const usd = usdByToken.get(lc(token));
    if (usd !== null && usd !== undefined && Number.isFinite(usd)) {
      row.priceUSD = usd;
      row.dayVolumeUSD += vol * usd;
    } else {
      row.priceUSD = implied;
    }
    row.dayVolume += vol;
    row.tradesCount += 1;
    row.ath = row.ath === 0 ? implied : Math.max(row.ath, implied);
    row.atl = row.atl === 0 ? implied : Math.min(row.atl, implied);
    await this.spotTokenRepo.save(row);
  }

  private async resolvePoolForTokens(
    a: string,
    b: string,
  ): Promise<string | null> {
    const edges = await this.edgeRepo.find({
      where: [{ token0: a, token1: b }, { token0: b, token1: a }],
    });
    if (edges.length === 0) return null;
    return lc(
      edges.map((e) => e.poolAddress).sort((x, y) => x.localeCompare(y))[0]!,
    );
  }

  private pairBucketUsdDeltas(
    bv: number,
    qv: number,
    base: string,
    quote: string,
    usdByToken: ReadonlyMap<string, number | null> | undefined,
  ): { baseUsd: number; quoteUsd: number } {
    if (!usdByToken) return { baseUsd: 0, quoteUsd: 0 };
    const usdB = usdByToken.get(lc(base));
    const usdQ = usdByToken.get(lc(quote));
    return {
      baseUsd:
        usdB !== null && usdB !== undefined && Number.isFinite(usdB)
          ? bv * usdB
          : 0,
      quoteUsd:
        usdQ !== null && usdQ !== undefined && Number.isFinite(usdQ)
          ? qv * usdQ
          : 0,
    };
  }

  private tokenBucketUsdDelta(
    vol: number,
    token: string,
    usdByToken: ReadonlyMap<string, number | null> | undefined,
  ): number {
    if (!usdByToken) return 0;
    const u = usdByToken.get(lc(token));
    return u !== null && u !== undefined && Number.isFinite(u) ? vol * u : 0;
  }

  private async advancePairBuckets(
    em: EntityManager,
    pair: string,
    resolution: SwapBucketResolution,
    eventTs: number,
    base: string,
    quote: string,
    symbol: string,
    swap: SwapIndexerBrokerPayload | null,
    usdByToken?: ReadonlyMap<string, number | null>,
  ): Promise<void> {
    const W = alignBucketStart(eventTs, resolution);
    const endTs = bucketEndExclusive(W, resolution);
    const stRepo = em.getRepository(SwapBucketStateEntity);
    const pbRepo = em.getRepository(SpotPairTimeBucketEntity);

    const st = await stRepo.findOne({
      where: { kind: 'pair', entityId: pair, resolution },
      lock: { mode: 'pessimistic_write' },
    });

    if (!st) {
      const prevTail = await this.previousPairBucketTail(pbRepo, pair, resolution);
      const existingW = await pbRepo.findOne({
        where: { pair, resolution, bucketStartTs: W },
      });
      if (existingW) {
        if (swap) {
          await this.mergePairIntoIndex(
            pbRepo,
            pair,
            resolution,
            existingW.bucketIndex,
            W,
            endTs,
            base,
            quote,
            symbol,
            swap,
            usdByToken,
          );
        }
        await stRepo.save({
          kind: 'pair',
          entityId: pair,
          resolution,
          lastBucketIndex: existingW.bucketIndex,
          lastBucketStartTs: W,
        });
        return;
      }
      await this.insertPairBucket(
        pbRepo,
        pair,
        resolution,
        1,
        W,
        endTs,
        base,
        quote,
        symbol,
        swap,
        prevTail,
        usdByToken,
      );
      await stRepo.save({
        kind: 'pair',
        entityId: pair,
        resolution,
        lastBucketIndex: 1,
        lastBucketStartTs: W,
      });
      return;
    }

    if (W < st.lastBucketStartTs) {
      await this.mergePairIntoExistingWindow(
        pbRepo,
        pair,
        resolution,
        W,
        endTs,
        base,
        quote,
        symbol,
        swap,
        usdByToken,
      );
      return;
    }

    if (W === st.lastBucketStartTs) {
      const prevTail = await this.previousPairBucketTail(pbRepo, pair, resolution);
      const atW = await pbRepo.findOne({
        where: { pair, resolution, bucketStartTs: W },
      });
      if (atW) {
        if (swap) {
          await this.mergePairIntoIndex(
            pbRepo,
            pair,
            resolution,
            atW.bucketIndex,
            W,
            endTs,
            base,
            quote,
            symbol,
            swap,
            usdByToken,
          );
        }
        return;
      }
      if (swap) {
        await this.insertPairBucket(
          pbRepo,
          pair,
          resolution,
          st.lastBucketIndex,
          W,
          endTs,
          base,
          quote,
          symbol,
          swap,
          prevTail,
          usdByToken,
        );
      }
      return;
    }

    let idx = st.lastBucketIndex;
    let cur = st.lastBucketStartTs;
    const prevPairTail = await this.previousPairBucketTail(pbRepo, pair, resolution);
    let steps = 0;
    while (cur < W && steps < MAX_GAP_STEPS) {
      const next = nextBucketStart(cur, resolution);
      if (next > W) {
        break;
      }
      steps += 1;
      const bucketStartTs = next < W ? next : W;
      const bucketEndTs =
        bucketStartTs === W ? endTs : bucketEndExclusive(bucketStartTs, resolution);
      const swapForBucket = bucketStartTs === W ? swap : null;

      const existingAt = await pbRepo.findOne({
        where: { pair, resolution, bucketStartTs },
      });
      if (existingAt) {
        idx = existingAt.bucketIndex;
        if (swapForBucket) {
          await this.mergePairIntoIndex(
            pbRepo,
            pair,
            resolution,
            existingAt.bucketIndex,
            bucketStartTs,
            bucketEndTs,
            base,
            quote,
            symbol,
            swapForBucket,
            usdByToken,
          );
        }
      } else {
        idx += 1;
        await this.insertPairBucket(
          pbRepo,
          pair,
          resolution,
          idx,
          bucketStartTs,
          bucketEndTs,
          base,
          quote,
          symbol,
          swapForBucket,
          prevPairTail,
          usdByToken,
        );
      }
      cur = next;
    }
    if (idx === st.lastBucketIndex && W > st.lastBucketStartTs) {
      idx = await this.mergeOrInsertPairBucketAtStartTs(
        pbRepo,
        pair,
        resolution,
        W,
        endTs,
        idx + 1,
        base,
        quote,
        symbol,
        swap,
        prevPairTail,
        usdByToken,
      );
    }
    await stRepo.update(
      { kind: 'pair', entityId: pair, resolution },
      { lastBucketIndex: idx, lastBucketStartTs: W },
    );
  }

  private async advanceTokenBuckets(
    em: EntityManager,
    token: string,
    resolution: SwapBucketResolution,
    eventTs: number,
    swap: SwapIndexerBrokerPayload | null,
    leg: 'in' | 'out',
    usdByToken?: ReadonlyMap<string, number | null>,
  ): Promise<void> {
    const W = alignBucketStart(eventTs, resolution);
    const endTs = bucketEndExclusive(W, resolution);
    const stRepo = em.getRepository(SwapBucketStateEntity);
    const tbRepo = em.getRepository(SpotTokenTimeBucketEntity);

    const st = await stRepo.findOne({
      where: { kind: 'token', entityId: token, resolution },
      lock: { mode: 'pessimistic_write' },
    });

    if (!st) {
      const prevTail = await this.previousTokenBucketTail(tbRepo, token, resolution);
      const vol = swap ? this.tokenLegVolume(swap, token, leg) : 0;
      const existingW = await tbRepo.findOne({
        where: { token, resolution, bucketStartTs: W },
      });
      if (existingW) {
        if (swap) {
          await this.mergeTokenIntoIndex(
            tbRepo,
            token,
            resolution,
            existingW.bucketIndex,
            W,
            endTs,
            swap,
            leg,
            usdByToken,
          );
        }
        await stRepo.save({
          kind: 'token',
          entityId: token,
          resolution,
          lastBucketIndex: existingW.bucketIndex,
          lastBucketStartTs: W,
        });
        return;
      }
      await this.insertTokenBucket(
        tbRepo,
        token,
        resolution,
        1,
        W,
        endTs,
        swap,
        leg,
        vol,
        prevTail,
        usdByToken,
      );
      await stRepo.save({
        kind: 'token',
        entityId: token,
        resolution,
        lastBucketIndex: 1,
        lastBucketStartTs: W,
      });
      return;
    }

    if (W < st.lastBucketStartTs) {
      await this.mergeTokenLate(
        tbRepo,
        token,
        resolution,
        W,
        endTs,
        swap,
        leg,
        usdByToken,
      );
      return;
    }

    if (W === st.lastBucketStartTs) {
      const prevTail = await this.previousTokenBucketTail(tbRepo, token, resolution);
      const atW = await tbRepo.findOne({
        where: { token, resolution, bucketStartTs: W },
      });
      if (atW) {
        if (swap) {
          await this.mergeTokenIntoIndex(
            tbRepo,
            token,
            resolution,
            atW.bucketIndex,
            W,
            endTs,
            swap,
            leg,
            usdByToken,
          );
        }
        return;
      }
      if (swap) {
        const vol = this.tokenLegVolume(swap, token, leg);
        await this.insertTokenBucket(
          tbRepo,
          token,
          resolution,
          st.lastBucketIndex,
          W,
          endTs,
          swap,
          leg,
          vol,
          prevTail,
          usdByToken,
        );
      }
      return;
    }

    let idx = st.lastBucketIndex;
    let cur = st.lastBucketStartTs;
    const prevTokenTail = await this.previousTokenBucketTail(tbRepo, token, resolution);
    let steps = 0;
    while (cur < W && steps < MAX_GAP_STEPS) {
      const next = nextBucketStart(cur, resolution);
      if (next > W) {
        break;
      }
      steps += 1;
      const bucketStartTs = next < W ? next : W;
      const bucketEndTs =
        bucketStartTs === W ? endTs : bucketEndExclusive(bucketStartTs, resolution);
      const swapForBucket = bucketStartTs === W ? swap : null;
      const volForBucket = swapForBucket
        ? this.tokenLegVolume(swapForBucket, token, leg)
        : 0;

      const existingAt = await tbRepo.findOne({
        where: { token, resolution, bucketStartTs },
      });
      if (existingAt) {
        idx = existingAt.bucketIndex;
        if (swapForBucket) {
          await this.mergeTokenIntoIndex(
            tbRepo,
            token,
            resolution,
            existingAt.bucketIndex,
            bucketStartTs,
            bucketEndTs,
            swapForBucket,
            leg,
            usdByToken,
          );
        }
      } else {
        idx += 1;
        await this.insertTokenBucket(
          tbRepo,
          token,
          resolution,
          idx,
          bucketStartTs,
          bucketEndTs,
          swapForBucket,
          leg,
          volForBucket,
          prevTokenTail,
          usdByToken,
        );
      }
      cur = next;
    }
    if (idx === st.lastBucketIndex && W > st.lastBucketStartTs) {
      const vol = swap ? this.tokenLegVolume(swap, token, leg) : 0;
      idx = await this.mergeOrInsertTokenBucketAtStartTs(
        tbRepo,
        token,
        resolution,
        W,
        endTs,
        idx + 1,
        swap,
        leg,
        vol,
        prevTokenTail,
        usdByToken,
      );
    }
    await stRepo.update(
      { kind: 'token', entityId: token, resolution },
      { lastBucketIndex: idx, lastBucketStartTs: W },
    );
  }

  private tokenLegVolume(
    swap: SwapIndexerBrokerPayload,
    token: string,
    leg: 'in' | 'out',
  ): number {
    const warn = (m: string) => this.logger.debug(m);
    const tin = lc(swap.tokenIn);
    const tout = lc(swap.tokenOut);
    if (leg === 'in' && token === tin) {
      return bigintToUiDouble(
        parseWireBigInt(swap.amountIn),
        warn,
        'swap.amountIn',
      );
    }
    if (leg === 'out' && token === tout) {
      return bigintToUiDouble(
        parseWireBigInt(swap.amountOut),
        warn,
        'swap.amountOut',
      );
    }
    return 0;
  }

  /**
   * Raw wei ratio amountOut/amountIn (dimensionless raw units). Used where pair
   * base/quote context is unavailable (e.g. token rows). Prefer
   * {@link swapQuotePerBaseHuman} for `spot_pairs.price` / pair OHLCV.
   */
  private swapPriceAmountRatio(swap: SwapIndexerBrokerPayload): number {
    const warn = (m: string) => this.logger.debug(m);
    const ai = bigintToUiDouble(
      parseWireBigInt(swap.amountIn),
      warn,
      'swap.amountIn',
    );
    const ao = bigintToUiDouble(
      parseWireBigInt(swap.amountOut),
      warn,
      'swap.amountOut',
    );
    if (ai === 0) return 0;
    return ao / ai;
  }

  private async resolveTokenDecimals(tokenId: string): Promise<number> {
    const row = await this.spotTokenRepo.findOne({ where: { id: lc(tokenId) } });
    const pairDisplay = this.configService.getOrThrow<BrokerConfig['pairDisplay']>(
      'pairDisplay',
    );
    return effectiveErc20Decimals(tokenId, row?.decimals, {
      stableQuoteAddresses: pairDisplay.stableQuoteAddresses,
    });
  }

  /** Human-friendly token amount from integer wei (same as swap-liquidity-graph). */
  private weiToUiDouble(wei: bigint, decimals: number): number {
    if (wei === 0n) return 0;
    const scale = 10n ** BigInt(decimals);
    const whole = wei / scale;
    const frac = wei % scale;
    return Number(whole) + Number(frac) / Number(scale);
  }

  /**
   * **Quote per base** in human units (matches `spot_pairs` mint path and
   * `DexUsdQuote` convention). `base`/`quote` are broker edge token0 / token1.
   */
  private async swapQuotePerBaseHuman(
    swap: SwapIndexerBrokerPayload,
    base: string,
    quote: string,
  ): Promise<number> {
    const b = lc(base);
    const q = lc(quote);
    const tin = lc(swap.tokenIn);
    const tout = lc(swap.tokenOut);
    const ai = parseWireBigInt(swap.amountIn);
    const ao = parseWireBigInt(swap.amountOut);
    const dB = await this.resolveTokenDecimals(b);
    const dQ = await this.resolveTokenDecimals(q);

    if (tin === b && tout === q) {
      const uiIn = this.weiToUiDouble(ai, dB);
      const uiOut = this.weiToUiDouble(ao, dQ);
      return uiIn === 0 ? 0 : uiOut / uiIn;
    }
    if (tin === q && tout === b) {
      const uiIn = this.weiToUiDouble(ai, dQ);
      const uiOut = this.weiToUiDouble(ao, dB);
      return uiOut === 0 ? 0 : uiIn / uiOut;
    }
    return this.swapPriceAmountRatio(swap);
  }

  /** Lookup by `(pair, resolution, bucketStartTs)` then merge or insert; returns the bucket index for that window. */
  private async mergeOrInsertPairBucketAtStartTs(
    pbRepo: Repository<SpotPairTimeBucketEntity>,
    pair: string,
    resolution: string,
    bucketStartTs: number,
    bucketEndTs: number,
    nextIndexIfInsert: number,
    base: string,
    quote: string,
    symbol: string,
    swap: SwapIndexerBrokerPayload | null,
    prevTail: SpotPairTimeBucketEntity | null,
    usdByToken?: ReadonlyMap<string, number | null>,
  ): Promise<number> {
    const existing = await pbRepo.findOne({
      where: { pair, resolution, bucketStartTs },
    });
    if (existing) {
      if (swap) {
        await this.mergePairIntoIndex(
          pbRepo,
          pair,
          resolution,
          existing.bucketIndex,
          bucketStartTs,
          bucketEndTs,
          base,
          quote,
          symbol,
          swap,
          usdByToken,
        );
      }
      return existing.bucketIndex;
    }
    await this.insertPairBucket(
      pbRepo,
      pair,
      resolution,
      nextIndexIfInsert,
      bucketStartTs,
      bucketEndTs,
      base,
      quote,
      symbol,
      swap,
      prevTail,
      usdByToken,
    );
    const row = await pbRepo.findOne({
      where: { pair, resolution, bucketStartTs },
    });
    return row?.bucketIndex ?? nextIndexIfInsert;
  }

  /** Lookup by `(token, resolution, bucketStartTs)` then merge or insert; returns the bucket index for that window. */
  private async mergeOrInsertTokenBucketAtStartTs(
    tbRepo: Repository<SpotTokenTimeBucketEntity>,
    token: string,
    resolution: string,
    bucketStartTs: number,
    bucketEndTs: number,
    nextIndexIfInsert: number,
    swap: SwapIndexerBrokerPayload | null,
    leg: 'in' | 'out',
    volumeAdd: number,
    prevTail: SpotTokenTimeBucketEntity | null,
    usdByToken?: ReadonlyMap<string, number | null>,
  ): Promise<number> {
    const existing = await tbRepo.findOne({
      where: { token, resolution, bucketStartTs },
    });
    if (existing) {
      if (swap) {
        await this.mergeTokenIntoIndex(
          tbRepo,
          token,
          resolution,
          existing.bucketIndex,
          bucketStartTs,
          bucketEndTs,
          swap,
          leg,
          usdByToken,
        );
      }
      return existing.bucketIndex;
    }
    await this.insertTokenBucket(
      tbRepo,
      token,
      resolution,
      nextIndexIfInsert,
      bucketStartTs,
      bucketEndTs,
      swap,
      leg,
      volumeAdd,
      prevTail,
      usdByToken,
    );
    const row = await tbRepo.findOne({
      where: { token, resolution, bucketStartTs },
    });
    return row?.bucketIndex ?? nextIndexIfInsert;
  }

  /**
   * Latest row for `(pair, resolution)`: flat **price** carry and **TVL** carry into newly inserted buckets.
   */
  private async previousPairBucketTail(
    repo: Repository<SpotPairTimeBucketEntity>,
    pair: string,
    resolution: string,
  ): Promise<SpotPairTimeBucketEntity | null> {
    const row = await repo.find({
      where: { pair, resolution },
      order: { bucketIndex: 'DESC' },
      take: 1,
    });
    return row[0] ?? null;
  }

  private async previousTokenBucketTail(
    repo: Repository<SpotTokenTimeBucketEntity>,
    token: string,
    resolution: string,
  ): Promise<SpotTokenTimeBucketEntity | null> {
    const row = await repo.find({
      where: { token, resolution },
      order: { bucketIndex: 'DESC' },
      take: 1,
    });
    return row[0] ?? null;
  }

  private async insertPairBucket(
    repo: Repository<SpotPairTimeBucketEntity>,
    pair: string,
    resolution: string,
    bucketIndex: number,
    bucketStartTs: number,
    bucketEndTs: number,
    base: string,
    quote: string,
    symbol: string,
    swap: SwapIndexerBrokerPayload | null,
    prevTail: SpotPairTimeBucketEntity | null,
    usdByToken?: ReadonlyMap<string, number | null>,
  ): Promise<void> {
    const prevClose = prevTail?.close ?? 0;
    const price =
      swap && base && quote
        ? await this.pairPrice(swap, base, quote)
        : prevClose;
    const o = swap ? price : prevClose;
    const h = swap ? price : prevClose;
    const l = swap ? price : prevClose;
    const c = swap ? price : prevClose;
    const { bv, qv, cnt } = swap
      ? this.pairVolumes(swap, base, quote)
      : { bv: 0, qv: 0, cnt: 0 };
    const { baseUsd, quoteUsd } = this.pairBucketUsdDeltas(
      bv,
      qv,
      base,
      quote,
      usdByToken,
    );
    const feeUsd = swap && usdByToken ? await this.estimateSwapFeeUsd(usdByToken, swap) : 0;
    const prevTotalBaseUsd = prevTail?.totalBaseVolumeUSD ?? 0;
    const prevTotalQuoteUsd = prevTail?.totalQuoteVolumeUSD ?? 0;
    const prevTotalFeesUsd = prevTail?.totalFeesUsd ?? 0;
    const prevTotalTrades = prevTail?.totalTrades ?? 0;

    const row = {
      pair,
      resolution,
      bucketIndex,
      bucketStartTs,
      bucketEndTs,
      base,
      quote,
      symbol,
      open: o,
      high: h,
      low: l,
      close: c,
      average: c,
      difference: 0,
      differencePercentage: 0,
      baseVolume: bv,
      quoteVolume: qv,
      baseVolumeUSD: baseUsd,
      quoteVolumeUSD: quoteUsd,
      totalBaseVolumeUSD: prevTotalBaseUsd + baseUsd,
      totalQuoteVolumeUSD: prevTotalQuoteUsd + quoteUsd,
      totalFeesUsd: prevTotalFeesUsd + feeUsd,
      totalTrades: prevTotalTrades + cnt,
      baseLiquidity: prevTail?.baseLiquidity ?? 0,
      quoteLiquidity: prevTail?.quoteLiquidity ?? 0,
      baseLiquidityUSD: prevTail?.baseLiquidityUSD ?? 0,
      quoteLiquidityUSD: prevTail?.quoteLiquidityUSD ?? 0,
      count: cnt,
    };
    try {
      await repo.insert(row);
    } catch (e) {
      if (!isPgUniqueViolation(e)) throw e;
      const existing = await repo.findOne({
        where: { pair, resolution, bucketStartTs },
      });
      if (existing && swap) {
        await this.mergePairIntoIndex(
          repo,
          pair,
          resolution,
          existing.bucketIndex,
          bucketStartTs,
          bucketEndTs,
          base,
          quote,
          symbol,
          swap,
          usdByToken,
        );
      }
    }
  }

  private async pairPrice(
    swap: SwapIndexerBrokerPayload,
    base: string,
    quote: string,
  ): Promise<number> {
    return this.swapQuotePerBaseHuman(swap, base, quote);
  }

  private pairVolumes(
    swap: SwapIndexerBrokerPayload,
    base: string,
    quote: string,
  ): { bv: number; qv: number; cnt: number } {
    const warn = (m: string) => this.logger.debug(m);
    const tin = lc(swap.tokenIn);
    const ai = bigintToUiDouble(
      parseWireBigInt(swap.amountIn),
      warn,
      'swap.amountIn',
    );
    const ao = bigintToUiDouble(
      parseWireBigInt(swap.amountOut),
      warn,
      'swap.amountOut',
    );
    if (tin === base) {
      return { bv: ai, qv: ao, cnt: 1 };
    }
    if (tin === quote) {
      return { bv: ao, qv: ai, cnt: 1 };
    }
    return { bv: 0, qv: 0, cnt: 0 };
  }

  private async mergePairIntoExistingWindow(
    repo: Repository<SpotPairTimeBucketEntity>,
    pair: string,
    resolution: string,
    W: number,
    endTs: number,
    base: string,
    quote: string,
    symbol: string,
    swap: SwapIndexerBrokerPayload | null,
    usdByToken?: ReadonlyMap<string, number | null>,
  ): Promise<void> {
    const row = await repo.findOne({ where: { pair, resolution, bucketStartTs: W } });
    if (!row || !swap) return;
    await this.mergePairIntoIndex(
      repo,
      pair,
      resolution,
      row.bucketIndex,
      W,
      endTs,
      base,
      quote,
      symbol,
      swap,
      usdByToken,
    );
  }

  private async mergePairIntoIndex(
    repo: Repository<SpotPairTimeBucketEntity>,
    pair: string,
    resolution: string,
    bucketIndex: number,
    W: number,
    endTs: number,
    base: string,
    quote: string,
    symbol: string,
    swap: SwapIndexerBrokerPayload | null,
    usdByToken?: ReadonlyMap<string, number | null>,
  ): Promise<void> {
    const row = await repo.findOne({
      where: { pair, resolution, bucketIndex },
    });
    if (!row) return;
    if (!swap) return;
    const p = await this.pairPrice(swap, base, quote);
    const { bv, qv, cnt } = this.pairVolumes(swap, base, quote);
    const { baseUsd, quoteUsd } = this.pairBucketUsdDeltas(
      bv,
      qv,
      base,
      quote,
      usdByToken,
    );
    const feeUsd = swap && usdByToken ? await this.estimateSwapFeeUsd(usdByToken, swap) : 0;
    const high = Math.max(row.high, p);
    const low = row.low === 0 ? p : Math.min(row.low, p);
    const close = p;
    await repo.update(
      { pair, resolution, bucketIndex },
      {
        high,
        low,
        close,
        average: (row.open + close) / 2,
        baseVolume: row.baseVolume + bv,
        quoteVolume: row.quoteVolume + qv,
        baseVolumeUSD: (row.baseVolumeUSD ?? 0) + baseUsd,
        quoteVolumeUSD: (row.quoteVolumeUSD ?? 0) + quoteUsd,
        totalBaseVolumeUSD: (row.totalBaseVolumeUSD ?? 0) + baseUsd,
        totalQuoteVolumeUSD: (row.totalQuoteVolumeUSD ?? 0) + quoteUsd,
        totalFeesUsd: (row.totalFeesUsd ?? 0) + feeUsd,
        totalTrades: (row.totalTrades ?? 0) + cnt,
        count: row.count + cnt,
        bucketEndTs: endTs,
        symbol: symbol || row.symbol,
      },
    );
  }

  private async insertTokenBucket(
    repo: Repository<SpotTokenTimeBucketEntity>,
    token: string,
    resolution: string,
    bucketIndex: number,
    bucketStartTs: number,
    bucketEndTs: number,
    swap: SwapIndexerBrokerPayload | null,
    leg: 'in' | 'out',
    volumeAdd: number,
    prevTail: SpotTokenTimeBucketEntity | null,
    usdByToken?: ReadonlyMap<string, number | null>,
  ): Promise<void> {
    const prevClose = prevTail?.close ?? 0;
    const px = swap ? this.swapPriceAmountRatio(swap) : prevClose;
    const o = swap ? px : prevClose;
    const cnt = swap ? 1 : 0;
    const volUsd = this.tokenBucketUsdDelta(volumeAdd, token, usdByToken);
    const feeUsd =
      swap && usdByToken && lc(swap.feeToken) === lc(token)
        ? await this.estimateSwapFeeUsd(usdByToken, swap)
        : 0;
    const prevTotalVolUsd = prevTail?.totalVolumeUSD ?? 0;
    const prevTotalFeesUsd = prevTail?.totalFeesUsd ?? 0;
    const prevTotalTrades = prevTail?.totalTrades ?? 0;
    const row = {
      token,
      resolution,
      bucketIndex,
      bucketStartTs,
      bucketEndTs,
      symbol: '',
      open: o,
      high: o,
      low: o,
      close: px,
      average: px,
      difference: 0,
      differencePercentage: 0,
      tvl: prevTail?.tvl ?? 0,
      tvlUSD: prevTail?.tvlUSD ?? 0,
      volume: volumeAdd,
      volumeUSD: volUsd,
      totalVolumeUSD: prevTotalVolUsd + volUsd,
      totalFeesUsd: prevTotalFeesUsd + feeUsd,
      totalTrades: prevTotalTrades + cnt,
      count: cnt,
    };
    try {
      await repo.insert(row);
    } catch (e) {
      if (!isPgUniqueViolation(e)) throw e;
      const existing = await repo.findOne({
        where: { token, resolution, bucketStartTs },
      });
      if (existing && swap) {
        await this.mergeTokenIntoIndex(
          repo,
          token,
          resolution,
          existing.bucketIndex,
          bucketStartTs,
          bucketEndTs,
          swap,
          leg,
          usdByToken,
        );
      }
    }
  }

  private async mergeTokenLate(
    repo: Repository<SpotTokenTimeBucketEntity>,
    token: string,
    resolution: string,
    W: number,
    endTs: number,
    swap: SwapIndexerBrokerPayload | null,
    leg: 'in' | 'out',
    usdByToken?: ReadonlyMap<string, number | null>,
  ): Promise<void> {
    const row = await repo.findOne({ where: { token, resolution, bucketStartTs: W } });
    if (!row || !swap) return;
    await this.mergeTokenIntoIndex(
      repo,
      token,
      resolution,
      row.bucketIndex,
      W,
      endTs,
      swap,
      leg,
      usdByToken,
    );
  }

  private async mergeTokenIntoIndex(
    repo: Repository<SpotTokenTimeBucketEntity>,
    token: string,
    resolution: string,
    bucketIndex: number,
    W: number,
    endTs: number,
    swap: SwapIndexerBrokerPayload | null,
    leg: 'in' | 'out',
    usdByToken?: ReadonlyMap<string, number | null>,
  ): Promise<void> {
    const row = await repo.findOne({
      where: { token, resolution, bucketIndex },
    });
    if (!row) return;
    if (!swap) return;
    const add = this.tokenLegVolume(swap, token, leg);
    const px = this.swapPriceAmountRatio(swap);
    const high = Math.max(row.high, px);
    const low = row.low === 0 ? px : Math.min(row.low, px);
    const dVolUsd = this.tokenBucketUsdDelta(add, token, usdByToken);
    const feeUsd =
      swap && usdByToken && lc(swap.feeToken) === lc(token)
        ? await this.estimateSwapFeeUsd(usdByToken, swap)
        : 0;
    await repo.update(
      { token, resolution, bucketIndex },
      {
        high,
        low,
        close: px,
        average: (row.open + px) / 2,
        volume: row.volume + add,
        volumeUSD: (row.volumeUSD ?? 0) + dVolUsd,
        totalVolumeUSD: (row.totalVolumeUSD ?? 0) + dVolUsd,
        totalFeesUsd: (row.totalFeesUsd ?? 0) + feeUsd,
        totalTrades: (row.totalTrades ?? 0) + 1,
        count: row.count + 1,
        bucketEndTs: endTs,
      },
    );
  }
}
