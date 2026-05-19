import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  effectiveErc20Decimals,
  pairReservesUsdNotional,
  resolveSwapRouteHopFeeBps,
  type CLLiquidityAddedIndexerBrokerPayload,
  type CLPoolCreatedIndexerBrokerPayload,
  type DynamicSwapFeeModuleCustomFeeSetIndexerBrokerPayload,
  type DynamicSwapFeeModuleDynamicFeeResetIndexerBrokerPayload,
  type LiquidityAddedIndexerBrokerPayload,
  type PoolCreatedIndexerBrokerPayload,
  type PoolFactorySetCustomFeeIndexerBrokerPayload,
  type PoolFactorySetFeeIndexerBrokerPayload,
  type SwapIndexerBrokerPayload,
  type SwapRouteHopDto,
} from '@giwater/shared';
import { In, Repository } from 'typeorm';
import { BrokerPoolFactoryFeeDefaultsEntity } from '../models/config/broker-pool-factory-fee-defaults.entity';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';
import { SpotTokenEntity } from '../models/token/spot-token.entity';
import { SwapLiquidityEdgeEntity } from '../models/swap/swap-liquidity-edge.entity';
import { LiquidityHistogramBucketEntity } from '../models/tick/liquidity-histogram-bucket.entity';
import { TickEntity } from '../models/tick/tick.entity';
import { AccountNotificationService } from '../account-notifications/account-notification.service';
import { ExchangeRollupService } from '../exchange/exchange-rollup.service';
import { DexUsdQuoteService } from '../pricing/dex-usd-quote.service';
import { parseWireBigInt } from '../swap-ohlcv/bigint-for-ui';
import { RetryableAggregationError } from '../aggregation/retryable-aggregation.error';
import { quotedPgColumn } from '../typeorm/quoted-pg-column';
import { rollSpotPairUtcDayWindow } from '../utils/spot-pair-utc-day-roll';
import { rollSpotTokenUtcDayWindow } from '../utils/spot-token-utc-day-roll';
import type { BrokerConfig } from '../config/configuration';
import {
  CL_HISTOGRAM_TICK_WIDTH,
  clHistogramBucketsForRange,
  tickToDisplayPrice,
} from './cl-liquidity-histogram';
import { alignBucketStart } from '../swap-ohlcv/swap-bucket-resolution';

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

/** Queue JSON may stringify small ints; accept finite 0–255 only. */
function parseOptionalDecimals(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 255) return undefined;
  return Math.floor(n);
}

type ParsedTokenInfo = {
  token: `0x${string}`;
  totalSupply: string;
  decimals?: number;
  name: string;
  symbol: string;
};

function parseTokenInfoWire(v: unknown): ParsedTokenInfo | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Partial<ParsedTokenInfo>;
  if (typeof o.token !== 'string' || !ADDR_RE.test(o.token)) return undefined;
  const dec = parseOptionalDecimals(o.decimals);
  const totalSupplyRaw = o.totalSupply;
  const totalSupply =
    typeof totalSupplyRaw === 'string' && totalSupplyRaw.length > 0
      ? totalSupplyRaw
      : '0';
  const out: ParsedTokenInfo = {
    token: o.token.toLowerCase() as `0x${string}`,
    totalSupply,
    name: typeof o.name === 'string' ? o.name : '',
    symbol: typeof o.symbol === 'string' ? o.symbol : '',
  };
  if (dec !== undefined) {
    out.decimals = dec;
  }
  return out;
}

const FACTORY_FEE_DEFAULTS_ID = 'default';

/** On-chain fee wire → basis points (same convention as web `usePoolFees`: divide by 100). */
function feeWireToBps(feeWire: string): number {
  const v = parseWireBigInt(feeWire);
  return Number(v / 100n);
}

function lc(addr: string): string {
  return addr.toLowerCase();
}

function resolveSwapRoutePoolKind(
  edge: SwapLiquidityEdgeEntity | undefined,
  pair: SpotPairEntity | undefined,
): 'volatile' | 'stable' | 'cl' {
  const isCl =
    edge?.isConcentratedLiquidity === true ||
    pair?.isConcentratedLiquidity === true;
  if (isCl) return 'cl';
  if (edge) {
    return edge.stable ? 'stable' : 'volatile';
  }
  if (pair && pair.type === 'stable') return 'stable';
  return 'volatile';
}

function inferBaseQuote(
  token0: string,
  token1: string,
  options: {
    stableQuoteAddresses: readonly string[];
    wrappedNativeAddress?: string;
    wrappedNativeIsQuoteWhenNoStable?: boolean;
  },
): { base: string; quote: string } {
  const t0 = lc(token0);
  const t1 = lc(token1);
  const stables = new Set(options.stableQuoteAddresses.map((a) => lc(a)).filter(Boolean));
  const s0 = stables.has(t0);
  const s1 = stables.has(t1);

  if (s0 && s1) return { base: t0, quote: t1 };
  if (s0 && !s1) return { base: t1, quote: t0 };
  if (!s0 && s1) return { base: t0, quote: t1 };

  const w = options.wrappedNativeAddress?.trim();
  const wLc = w ? lc(w) : '';
  const nativeQuote = options.wrappedNativeIsQuoteWhenNoStable !== false;
  if (nativeQuote && wLc) {
    if (t0 === wLc) return { base: t1, quote: t0 };
    if (t1 === wLc) return { base: t0, quote: t1 };
  }

  return { base: t0, quote: t1 };
}

function addNumericString(a: string, b: string): string {
  return (BigInt(a || '0') + BigInt(b || '0')).toString();
}

function tickFromWire(s: string): number {
  return Number(parseWireBigInt(s));
}

/**
 * Token–pool liquidity graph: edges live in Postgres (`swap_liquidity_edges`);
 * multi-hop routes use BFS (shortest hop count). A dedicated graph DB can replace
 * storage/query behind this service without changing the HTTP contract.
 */
@Injectable()
export class SwapLiquidityGraphService implements OnModuleInit {
  private readonly logger = new Logger(SwapLiquidityGraphService.name);

  constructor(
    @InjectRepository(SwapLiquidityEdgeEntity)
    private readonly edgeRepo: Repository<SwapLiquidityEdgeEntity>,
    @InjectRepository(BrokerPoolFactoryFeeDefaultsEntity)
    private readonly factoryFeeDefaultsRepo: Repository<BrokerPoolFactoryFeeDefaultsEntity>,
    @InjectRepository(SpotPairEntity)
    private readonly pairRepo: Repository<SpotPairEntity>,
    @InjectRepository(SpotTokenEntity)
    private readonly tokenRepo: Repository<SpotTokenEntity>,
    @InjectRepository(TickEntity)
    private readonly tickRepo: Repository<TickEntity>,
    @InjectRepository(LiquidityHistogramBucketEntity)
    private readonly histRepo: Repository<LiquidityHistogramBucketEntity>,
    private readonly dexUsdQuote: DexUsdQuoteService,
    private readonly exchangeRollup: ExchangeRollupService,
    private readonly accountNotifications: AccountNotificationService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.normalizePersistedPairOrientation();
  }

  async onPoolCreated(payload: PoolCreatedIndexerBrokerPayload): Promise<void> {
    const pool = lc(payload.pool);
    const token0 = lc(payload.token0);
    const token1 = lc(payload.token1);
    const base = lc(payload.base);
    const quote = lc(payload.quote);
    const t0Info = parseTokenInfoWire(payload.token0Info);
    const t1Info = parseTokenInfoWire(payload.token1Info);
    const baseInfo = base === token0 ? t0Info : t1Info;
    const quoteInfo = quote === token1 ? t1Info : t0Info;
    const baseDecimals =
      base === token0 ? t0Info?.decimals : t1Info?.decimals;
    const quoteDecimals =
      quote === token1 ? t1Info?.decimals : t0Info?.decimals;
    await this.upsertEdge({
      poolAddress: pool,
      token0,
      token1,
      stable: payload.stable,
      isConcentratedLiquidity: false,
      clTickSpacing: null,
    });
    await this.upsertSpotPairMinimal({
      pool,
      token0,
      token1,
      base,
      quote,
      stable: payload.stable,
      isConcentratedLiquidity: false,
      dynamicFee: false,
      baseDecimals,
      quoteDecimals,
      baseName: baseInfo?.name ?? '',
      quoteName: quoteInfo?.name ?? '',
      baseSymbol: baseInfo?.symbol ?? '',
      quoteSymbol: quoteInfo?.symbol ?? '',
    });
    await this.applyTokenInfoFromIndexer(token0, t0Info);
    await this.applyTokenInfoFromIndexer(token1, t1Info);
    await this.applyFactoryTierToBasicPoolIfKnown(pool, payload.stable);
    const blockTs = Number(parseWireBigInt(String(payload.blockTimestamp)));
    await this.exchangeRollup.recordNewPair({ blockTs });
    this.logger.log(`Swap graph + spot pair upserted for PoolCreated pool=${pool}`);
  }

  async onCLPoolCreated(
    payload: CLPoolCreatedIndexerBrokerPayload,
  ): Promise<void> {
    const pool = lc(payload.pool);
    const token0 = lc(payload.token0);
    const token1 = lc(payload.token1);
    const base = lc(payload.base);
    const quote = lc(payload.quote);
    const t0Info = parseTokenInfoWire(payload.token0Info);
    const t1Info = parseTokenInfoWire(payload.token1Info);
    const baseInfo = base === token0 ? t0Info : t1Info;
    const quoteInfo = quote === token1 ? t1Info : t0Info;
    const baseDecimals =
      base === token0 ? t0Info?.decimals : t1Info?.decimals;
    const quoteDecimals =
      quote === token1 ? t1Info?.decimals : t0Info?.decimals;
    const clTickSpacing = Number(parseWireBigInt(String(payload.tickSpacing)));
    await this.upsertEdge({
      poolAddress: pool,
      token0,
      token1,
      stable: false,
      isConcentratedLiquidity: true,
      clTickSpacing,
    });
    await this.upsertSpotPairMinimal({
      pool,
      token0,
      token1,
      base,
      quote,
      stable: false,
      isConcentratedLiquidity: true,
      dynamicFee: true,
      effectiveFeeBps: null,
      feeSource: 'cl_module_dynamic',
      clTickSpacing,
      baseDecimals,
      quoteDecimals,
      baseName: baseInfo?.name ?? '',
      quoteName: quoteInfo?.name ?? '',
      baseSymbol: baseInfo?.symbol ?? '',
      quoteSymbol: quoteInfo?.symbol ?? '',
    });
    await this.applyTokenInfoFromIndexer(token0, t0Info);
    await this.applyTokenInfoFromIndexer(token1, t1Info);
    const blockTs = Number(parseWireBigInt(String(payload.blockTimestamp)));
    await this.exchangeRollup.recordNewPair({ blockTs });
    this.logger.log(`Swap graph + spot pair upserted for CLPoolCreated pool=${pool}`);
  }

  /**
   * i), ii) basic pools only:
   * stable=false -> volatile pairs, stable=true -> stable pairs.
   * This event updates the default tier fee for that pair class on-chain.
   * Current read model stores policy class (not fee numeric), so we refresh flags.
   */
  async onPoolFactorySetFee(payload: PoolFactorySetFeeIndexerBrokerPayload): Promise<void> {
    const type = payload.stable ? 'stable' : 'volatile';
    const bps = feeWireToBps(String(payload.fee));
    await this.upsertFactoryTierDefaults(payload.stable, bps);

    const cIsCl = quotedPgColumn(this.pairRepo, 'isConcentratedLiquidity');
    const cPairType = quotedPgColumn(this.pairRepo, 'type');
    const cFeeSrc = quotedPgColumn(this.pairRepo, 'feeSource');

    const res = await this.pairRepo
      .createQueryBuilder()
      .update(SpotPairEntity)
      .set({
        dynamicFee: false,
        effectiveFeeBps: bps,
        feeSource: 'factory_tier',
      })
      .where(`${cIsCl} = :isCL`, { isCL: false })
      .andWhere(`${cPairType} = :type`, { type })
      .andWhere(
        `(${cFeeSrc} IS NULL OR ${cFeeSrc} = :empty OR ${cFeeSrc} = :tier)`,
        { empty: '', tier: 'factory_tier' },
      )
      .execute();

    this.logger.log(
      `PoolFactory:SetFee applied to ${type} basic pairs bps=${bps} affected=${res.affected ?? 0} id=${payload.id}`,
    );
  }

  /**
   * i), ii) basic pools only: pool-specific custom fee configuration.
   */
  async onPoolFactorySetCustomFee(
    payload: PoolFactorySetCustomFeeIndexerBrokerPayload,
  ): Promise<void> {
    const pool = lc(payload.pool);
    const pair = await this.pairRepo.findOne({ where: { id: pool } });
    if (!pair) {
      this.logger.warn(
        `PoolFactory:SetCustomFee skipped (pair not found) pool=${pool} id=${payload.id}`,
      );
      return;
    }
    if (pair.isConcentratedLiquidity) {
      this.logger.warn(
        `PoolFactory:SetCustomFee skipped (CL pair) pool=${pool} id=${payload.id}`,
      );
      return;
    }

    const bps = feeWireToBps(String(payload.fee));
    await this.pairRepo.update(
      { id: pool },
      {
        dynamicFee: false,
        effectiveFeeBps: bps,
        feeSource: 'factory_custom',
      },
    );
    this.logger.log(
      `PoolFactory:SetCustomFee applied to basic pair pool=${pool} bps=${bps} id=${payload.id}`,
    );
  }

  /**
   * iii) CL pools: module custom fee means non-dynamic mode for that pool.
   */
  async onDynamicSwapFeeModuleCustomFeeSet(
    payload: DynamicSwapFeeModuleCustomFeeSetIndexerBrokerPayload,
  ): Promise<void> {
    const pool = lc(payload.pool);
    const bps = feeWireToBps(String(payload.fee));
    const res = await this.pairRepo
      .createQueryBuilder()
      .update(SpotPairEntity)
      .set({
        dynamicFee: false,
        isConcentratedLiquidity: true,
        effectiveFeeBps: bps,
        feeSource: 'cl_module_fixed',
      })
      .where('id = :pool', { pool })
      .execute();

    if (!res.affected) {
      this.logger.warn(
        `DynamicSwapFeeModule:CustomFeeSet skipped (pair not found) pool=${pool} id=${payload.id}`,
      );
      return;
    }
    this.logger.log(
      `DynamicSwapFeeModule:CustomFeeSet applied pool=${pool} bps=${bps} id=${payload.id}`,
    );
  }

  /**
   * iii) CL pools: reset returns pool to dynamic-fee mode.
   */
  async onDynamicSwapFeeModuleDynamicFeeReset(
    payload: DynamicSwapFeeModuleDynamicFeeResetIndexerBrokerPayload,
  ): Promise<void> {
    const pool = lc(payload.pool);
    const res = await this.pairRepo
      .createQueryBuilder()
      .update(SpotPairEntity)
      .set({
        dynamicFee: true,
        isConcentratedLiquidity: true,
        effectiveFeeBps: null,
        feeSource: 'cl_module_dynamic',
      })
      .where('id = :pool', { pool })
      .execute();

    if (!res.affected) {
      this.logger.warn(
        `DynamicSwapFeeModule:DynamicFeeReset skipped (pair not found) pool=${pool} id=${payload.id}`,
      );
      return;
    }
    this.logger.log(
      `DynamicSwapFeeModule:DynamicFeeReset applied pool=${pool} id=${payload.id}`,
    );
  }

  /**
   * Volatile/stable pool: add liquidity → `baseLiquidity`/`quoteLiquidity` (running) and UTC-day `dayBaseTvl`/`dayQuoteTvl`
   * (pair must exist from `PoolCreated`).
   */
  async onLiquidityAdded(
    payload: LiquidityAddedIndexerBrokerPayload,
  ): Promise<void> {
    const pool = await this.resolveV2Pool(
      lc(payload.token0),
      lc(payload.token1),
      payload.stable,
    );
    if (!pool) {
      this.logger.warn(
        `LiquidityAdded: no v2 edge for tokens ${payload.token0}/${payload.token1} stable=${payload.stable} id=${payload.id}`,
      );
      return;
    }
    const blockTs = Number(parseWireBigInt(String(payload.blockTimestamp)));
    await this.incrementPairLiquidityFromAmounts(
      pool,
      lc(payload.token0),
      lc(payload.token1),
      String(payload.amount0),
      String(payload.amount1),
      blockTs,
    );
    await this.accountNotifications.recordLiquidityAdded({
      poolAddress: pool,
      payload,
      blockTsSec: blockTs,
    });
    this.logger.log(`LiquidityAdded applied for pool=${pool} id=${payload.id}`);
  }

  /**
   * CL pool: same pair reserve-style increment as v2, plus Uniswap-style tick
   * boundaries and per–tick-range histogram buckets for concentrated depth.
   */
  async onCLLiquidityAdded(
    payload: CLLiquidityAddedIndexerBrokerPayload,
  ): Promise<void> {
    const t0 = lc(payload.token0);
    const t1 = lc(payload.token1);
    const tickSpacing = Number(parseWireBigInt(String(payload.tickSpacing)));
    const pool = await this.resolveCLPool(t0, t1, tickSpacing);
    if (!pool) {
      this.logger.warn(
        `CLLiquidityAdded: no CL edge for tokens ${t0}/${t1} spacing=${tickSpacing} id=${payload.id}`,
      );
      throw new RetryableAggregationError(
        `CLLiquidityAdded: missing CL edge (tokens ${t0}/${t1} spacing=${tickSpacing})`,
      );
    }

    const blockTs = Number(parseWireBigInt(String(payload.blockTimestamp)));
    await this.incrementPairLiquidityFromAmounts(
      pool,
      t0,
      t1,
      String(payload.amount0),
      String(payload.amount1),
      blockTs,
    );

    await this.accountNotifications.recordLiquidityAdded({
      poolAddress: pool,
      payload,
      blockTsSec: blockTs,
    });

    const tickLower = tickFromWire(String(payload.tickLower));
    const tickUpper = tickFromWire(String(payload.tickUpper));
    const L = parseWireBigInt(String(payload.liquidity));
    if (tickUpper <= tickLower || L <= 0n) {
      this.logger.warn(
        `CLLiquidityAdded: skip tick/histogram (invalid range or zero L) id=${payload.id}`,
      );
      return;
    }

    await this.applyClTickBoundaryLiquidity(pool, tickLower, tickUpper, L);
    await this.applyClLiquidityHistogram(
      pool,
      tickLower,
      tickUpper,
      L,
      payload,
    );

    this.logger.log(`CLLiquidityAdded applied for pool=${pool} id=${payload.id}`);
  }

  /**
   * Resolves `from` / `to` query: `0x` + 40 hex = address; otherwise token symbol via `spot_tokens`.
   */
  async resolveTokenQuery(tokenQuery: string): Promise<string> {
    const trimmed = tokenQuery.trim();
    if (!trimmed) {
      throw new UnprocessableEntityException('Token query must be non-empty');
    }
    if (ADDR_RE.test(trimmed)) {
      return lc(trimmed);
    }
    const row = await this.tokenRepo
      .createQueryBuilder('t')
      .where('LOWER(t.symbol) = LOWER(:sym)', { sym: trimmed })
      .getOne();
    if (!row) {
      throw new NotFoundException(
        `Unknown token symbol or address: ${tokenQuery}`,
      );
    }
    return lc(row.id);
  }

  /**
   * Shortest hop-count path in the liquidity graph (undirected pool edges).
   */
  async findShortestRoute(
    fromToken: string,
    toToken: string,
    maxHops = 8,
  ): Promise<SwapRouteHopDto[]> {
    const from = lc(fromToken);
    const to = lc(toToken);
    if (from === to) {
      return [];
    }

    const edges = await this.edgeRepo.find();
    if (edges.length === 0) {
      throw new NotFoundException('No liquidity pools indexed yet');
    }

    const adj = new Map<string, Array<{ neighbor: string; pool: string }>>();
    const add = (a: string, b: string, pool: string) => {
      const la = lc(a);
      const lb = lc(b);
      const list = adj.get(la) ?? [];
      list.push({ neighbor: lb, pool });
      adj.set(la, list);
    };
    for (const e of edges) {
      const p = lc(e.poolAddress);
      add(e.token0, e.token1, p);
      add(e.token1, e.token0, p);
    }

    const queue: string[] = [from];
    const visited = new Set<string>([from]);
    const depthMap = new Map<string, number>([[from, 0]]);
    const parent = new Map<string, { prev: string; pool: string }>();

    let found = false;
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const depth = depthMap.get(cur) ?? 0;
      if (cur === to) {
        found = true;
        break;
      }
      if (depth >= maxHops) {
        continue;
      }
      for (const { neighbor, pool } of adj.get(cur) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        depthMap.set(neighbor, depth + 1);
        parent.set(neighbor, { prev: cur, pool });
        queue.push(neighbor);
      }
    }

    if (!found) {
      throw new NotFoundException('No swap route between the given tokens');
    }

    const hopCores: Array<{
      pairAddress: string;
      tokenIn: string;
      tokenOut: string;
    }> = [];
    let cur = to;
    while (cur !== from) {
      const meta = parent.get(cur);
      if (!meta) {
        throw new NotFoundException('Route reconstruction failed');
      }
      hopCores.push({
        pairAddress: meta.pool,
        tokenIn: meta.prev,
        tokenOut: cur,
      });
      cur = meta.prev;
    }
    hopCores.reverse();
    return this.hydrateSwapRouteHops(hopCores);
  }

  /**
   * Public helper for swap-route UX: resolve token decimals as used by broker effective-decimals rules.
   */
  async resolveTokenDecimalsForSwapRoute(tokenAddress: string): Promise<number> {
    return this.resolveTokenDecimals(lc(tokenAddress));
  }

  /**
   * Attach fee metadata from `spot_pairs` and pool kind from `swap_liquidity_edges`.
   */
  private async hydrateSwapRouteHops(
    hopCores: Array<{
      pairAddress: string;
      tokenIn: string;
      tokenOut: string;
    }>,
  ): Promise<SwapRouteHopDto[]> {
    if (hopCores.length === 0) {
      return [];
    }
    const ids = [...new Set(hopCores.map((h) => lc(h.pairAddress)))];
    const tokenIds = [
      ...new Set(
        hopCores.flatMap((h) => [lc(h.tokenIn), lc(h.tokenOut)]).filter(Boolean),
      ),
    ];
    const [pairs, edges, tokens] = await Promise.all([
      this.pairRepo.find({ where: { id: In(ids) } }),
      this.edgeRepo.find({ where: { poolAddress: In(ids) } }),
      tokenIds.length > 0
        ? this.tokenRepo.find({ where: { id: In(tokenIds) } })
        : Promise.resolve([] as SpotTokenEntity[]),
    ]);
    const pairByPool = new Map(pairs.map((p) => [lc(p.id), p]));
    const edgeByPool = new Map(edges.map((e) => [lc(e.poolAddress), e]));
    const tokenById = new Map(tokens.map((t) => [lc(t.id), t]));

    const defaults = await this.factoryFeeDefaultsRepo.findOne({
      where: { id: FACTORY_FEE_DEFAULTS_ID },
    });

    return hopCores.map((h) => {
      const id = lc(h.pairAddress);
      const pair = pairByPool.get(id);
      const edge = edgeByPool.get(id);
      const inTok = tokenById.get(lc(h.tokenIn));
      const outTok = tokenById.get(lc(h.tokenOut));
      const rawSrc = pair?.feeSource?.trim();
      const poolKind = resolveSwapRoutePoolKind(edge, pair);
      const effectiveFeeBps = pair?.effectiveFeeBps ?? null;
      return {
        pairAddress: h.pairAddress,
        tokenIn: h.tokenIn,
        inputTokenLogo: inTok?.logoURI ? inTok.logoURI : null,
        tokenOut: h.tokenOut,
        outputTokenLogo: outTok?.logoURI ? outTok.logoURI : null,
        effectiveFeeBps,
        feeBps: resolveSwapRouteHopFeeBps({
          effectiveFeeBps,
          poolKind,
          factoryVolatileFeeBps: defaults?.volatileFeeBps,
          factoryStableFeeBps: defaults?.stableFeeBps,
        }),
        feeSource: rawSrc ?? '',
        poolKind,
        tickSpacing: poolKind === 'cl' ? (edge?.clTickSpacing ?? 0) : 0,
        priceImpactPercent: null,
        feeOnInputWei: null,
      };
    });
  }

  private async resolveV2Pool(
    token0: string,
    token1: string,
    stable: boolean,
  ): Promise<string | null> {
    const edges = await this.edgeRepo.find({
      where: [
        {
          token0,
          token1,
          stable,
          isConcentratedLiquidity: false,
        },
        {
          token0: token1,
          token1: token0,
          stable,
          isConcentratedLiquidity: false,
        },
      ],
    });
    if (edges.length === 0) return null;
    return lc(
      edges.map((e) => e.poolAddress).sort((a, b) => a.localeCompare(b))[0]!,
    );
  }

  private async resolveCLPool(
    token0: string,
    token1: string,
    tickSpacing: number,
  ): Promise<string | null> {
    const edges = await this.edgeRepo.find({
      where: [
        {
          token0,
          token1,
          isConcentratedLiquidity: true,
        },
        {
          token0: token1,
          token1: token0,
          isConcentratedLiquidity: true,
        },
      ],
    });
    if (edges.length === 0) return null;
    const bySpacing = edges.filter(
      (e) => e.clTickSpacing === null || e.clTickSpacing === tickSpacing,
    );
    const pick = (bySpacing.length > 0 ? bySpacing : edges).sort((a, b) =>
      a.poolAddress.localeCompare(b.poolAddress),
    );
    return lc(pick[0]!.poolAddress);
  }

  /**
   * Resolve pool for one router `Swap` hop using `isCL` and `stable` so volatile/stable/CL
   * pools sharing the same token pair do not collide.
   */
  private async resolvePoolForSwapEvent(
    tokenIn: string,
    tokenOut: string,
    isCL: boolean,
    stable: boolean,
  ): Promise<string | null> {
    const a = lc(tokenIn);
    const b = lc(tokenOut);
    if (isCL) {
      const edges = await this.edgeRepo.find({
        where: [
          {
            token0: a,
            token1: b,
            isConcentratedLiquidity: true,
          },
          {
            token0: b,
            token1: a,
            isConcentratedLiquidity: true,
          },
        ],
      });
      if (edges.length === 0) return null;
      return lc(
        edges.map((e) => e.poolAddress).sort((x, y) => x.localeCompare(y))[0]!,
      );
    }
    return this.resolveV2Pool(a, b, stable);
  }

  /**
   * Router swap hop: pool gains `amountIn` of `tokenIn` and loses `amountOut` of `tokenOut`.
   * Updates `spot_pairs.baseLiquidity` / `quoteLiquidity` proxy reserves used for off-chain routing quotes.
   */
  async onSwap(payload: SwapIndexerBrokerPayload): Promise<void> {
    const tokenIn = lc(payload.tokenIn);
    const tokenOut = lc(payload.tokenOut);
    const pool = await this.resolvePoolForSwapEvent(
      tokenIn,
      tokenOut,
      payload.isCL,
      payload.stable,
    );
    if (!pool) {
      this.logger.warn(
        `Swap graph: no edge for reserves in=${tokenIn} out=${tokenOut} isCL=${payload.isCL} stable=${payload.stable} id=${payload.id}`,
      );
      return;
    }

    const pair = await this.pairRepo.findOne({ where: { id: pool } });
    if (!pair) {
      this.logger.warn(
        `Swap graph: spot_pairs missing for pool=${pool} id=${payload.id}`,
      );
      return;
    }

    const base = lc(pair.base);
    const quote = lc(pair.quote);
    if (
      tokenIn === tokenOut ||
      (tokenIn !== base && tokenIn !== quote) ||
      (tokenOut !== base && tokenOut !== quote)
    ) {
      this.logger.warn(
        `Swap graph: token mismatch pool=${pool} base=${base} quote=${quote} in=${tokenIn} out=${tokenOut} id=${payload.id}`,
      );
      return;
    }

    const amountInWei = parseWireBigInt(String(payload.amountIn));
    const amountOutWei = parseWireBigInt(String(payload.amountOut));

    const decBase = await this.resolveTokenDecimals(base);
    const decQuote = await this.resolveTokenDecimals(quote);

    let dBaseUi = 0;
    let dQuoteUi = 0;
    if (tokenIn === base) {
      dBaseUi += this.weiToUiDouble(amountInWei, decBase);
    } else {
      dQuoteUi += this.weiToUiDouble(amountInWei, decQuote);
    }
    if (tokenOut === base) {
      dBaseUi -= this.weiToUiDouble(amountOutWei, decBase);
    } else {
      dQuoteUi -= this.weiToUiDouble(amountOutWei, decQuote);
    }

    pair.baseLiquidity = Math.max(0, (pair.baseLiquidity ?? 0) + dBaseUi);
    pair.quoteLiquidity = Math.max(0, (pair.quoteLiquidity ?? 0) + dQuoteUi);

    const uiIn =
      tokenIn === base
        ? this.weiToUiDouble(amountInWei, decBase)
        : this.weiToUiDouble(amountInWei, decQuote);
    const uiOut =
      tokenOut === base
        ? this.weiToUiDouble(amountOutWei, decBase)
        : this.weiToUiDouble(amountOutWei, decQuote);
    let priceUpdated = false;
    if (uiIn > 0 && uiOut > 0) {
      if (tokenIn === base && tokenOut === quote) {
        pair.price = uiOut / uiIn;
        priceUpdated = true;
      } else if (tokenIn === quote && tokenOut === base) {
        pair.price = uiIn / uiOut;
        priceUpdated = true;
      }
    }

    const patch: Partial<
      Pick<SpotPairEntity, 'baseLiquidity' | 'quoteLiquidity' | 'price'>
    > = {
      baseLiquidity: pair.baseLiquidity,
      quoteLiquidity: pair.quoteLiquidity,
    };
    if (priceUpdated) {
      patch.price = pair.price;
    }
    await this.pairRepo.update({ id: pool }, patch);
    this.logger.log(
      `Swap graph: proxy reserves updated pool=${pool} baseLiquidity=${pair.baseLiquidity} quoteLiquidity=${pair.quoteLiquidity} id=${payload.id}`,
    );
  }

  /**
   * Maps indexer `token0` / `token1` amounts to `spot_pairs.base` / `spot_pairs.quote` TVL columns,
   * updates `spot_pairs.price` from mint-implied quote/base, and USD TVL + token `priceUSD` / `dayTvlUSD`
   * when `DEX_USD_QUOTE_*` env is configured.
   */
  private async incrementPairLiquidityFromAmounts(
    pool: string,
    indexerToken0: string,
    indexerToken1: string,
    amount0Wei: string,
    amount1Wei: string,
    blockTsSec: number,
  ): Promise<void> {
    const pair = await this.pairRepo.findOne({ where: { id: pool } });
    const edge = await this.edgeRepo.findOne({ where: { poolAddress: pool } });
    if (!pair) {
      this.logger.warn(
        `incrementPairLiquidity: missing spot_pairs row for pool=${pool}`,
      );
      return;
    }
    // Ensure (indexerToken0,indexerToken1,amount0Wei,amount1Wei) are aligned to the pool's
    // canonical on-chain token0/token1 as recorded in `swap_liquidity_edges`.
    //
    // If the indexer payload token order ever drifts (e.g. due to upstream sorting),
    // base/quote TVL accumulation will silently invert, which then breaks swap-route quotes.
    const edgeT0 = lc(edge?.token0 ?? '');
    const edgeT1 = lc(edge?.token1 ?? '');
    let t0 = lc(indexerToken0);
    let t1 = lc(indexerToken1);
    let a0 = amount0Wei;
    let a1 = amount1Wei;
    if (edgeT0 && edgeT1 && ((t0 !== edgeT0) || (t1 !== edgeT1))) {
      if (t0 === edgeT1 && t1 === edgeT0) {
        // Swap payload order to match edge token0/token1.
        [t0, t1] = [t1, t0];
        [a0, a1] = [a1, a0];
      } else {
        this.logger.warn(
          `incrementPairLiquidity: payload token0/1 mismatch pool=${pool} edge0=${edgeT0} edge1=${edgeT1} idx0=${t0} idx1=${t1}`,
        );
      }
    }
    const base = lc(pair.base);
    const quote = lc(pair.quote);
    let dBaseWei = '0';
    let dQuoteWei = '0';
    if (t0 === base && t1 === quote) {
      dBaseWei = a0;
      dQuoteWei = a1;
    } else if (t0 === quote && t1 === base) {
      dBaseWei = a1;
      dQuoteWei = a0;
    } else {
      this.logger.warn(
        `incrementPairLiquidity: token mismatch pool=${pool} base=${base} quote=${quote} idx0=${t0} idx1=${t1}`,
      );
      return;
    }

    const decBase = await this.resolveTokenDecimals(base);
    const decQuote = await this.resolveTokenDecimals(quote);
    if (!pair.baseName || !pair.quoteName || !pair.baseSymbol || !pair.quoteSymbol) {
      const [baseTok, quoteTok] = await Promise.all([
        this.tokenRepo.findOne({ where: { id: base } }),
        this.tokenRepo.findOne({ where: { id: quote } }),
      ]);
      if (baseTok?.name) pair.baseName = baseTok.name;
      if (quoteTok?.name) pair.quoteName = quoteTok.name;
      if (baseTok?.symbol) pair.baseSymbol = baseTok.symbol;
      if (quoteTok?.symbol) pair.quoteSymbol = quoteTok.symbol;
      if (pair.baseName && pair.quoteName) {
        const pairLabel = `${pair.baseName}/${pair.quoteName}`;
        pair.symbol = pairLabel;
        pair.ticker = pairLabel;
      }
    }
    const uiBase = this.weiToUiDouble(parseWireBigInt(dBaseWei), decBase);
    const uiQuote = this.weiToUiDouble(parseWireBigInt(dQuoteWei), decQuote);

    // Backfill pair decimals if PoolCreated arrived without TokenInfo.
    if ((pair.bDecimal ?? 0) <= 0 && decBase > 0) {
      pair.bDecimal = decBase;
    }
    if ((pair.qDecimal ?? 0) <= 0 && decQuote > 0) {
      pair.qDecimal = decQuote;
    }

    const dayKey = alignBucketStart(blockTsSec, '1d');
    rollSpotPairUtcDayWindow(pair, dayKey);

    pair.dayBaseTvl = (pair.dayBaseTvl ?? 0) + uiBase;
    pair.dayQuoteTvl = (pair.dayQuoteTvl ?? 0) + uiQuote;
    pair.baseLiquidity = (pair.baseLiquidity ?? 0) + uiBase;
    pair.quoteLiquidity = (pair.quoteLiquidity ?? 0) + uiQuote;

    const token0 = lc(edge?.token0 ?? '');
    const token1 = lc(edge?.token1 ?? '');
    const dToken0 =
      token0 && indexerToken0 === token0
        ? amount0Wei
        : token0 && indexerToken1 === token0
          ? amount1Wei
          : amount0Wei;
    const dToken1 =
      token1 && indexerToken1 === token1
        ? amount1Wei
        : token1 && indexerToken0 === token1
          ? amount0Wei
          : amount1Wei;
    const decToken0 = await this.resolveTokenDecimals(token0 || indexerToken0);
    const decToken1 = await this.resolveTokenDecimals(token1 || indexerToken1);
    const uiToken0 = this.weiToUiDouble(parseWireBigInt(dToken0), decToken0);
    const uiToken1 = this.weiToUiDouble(parseWireBigInt(dToken1), decToken1);

    if (uiToken0 > 0 && uiToken1 >= 0) {
      const impliedPx = uiToken1 / uiToken0;
      if (Number.isFinite(impliedPx) && impliedPx > 0) {
        pair.price = impliedPx;
      }
    }

    await this.pairRepo.save(pair);

    const usdMap = await this.dexUsdQuote.resolveUsdPricesForTokens([
      base,
      quote,
    ]);
    const usdB = usdMap.get(base);
    const usdQ = usdMap.get(quote);
    const fresh = await this.pairRepo.findOne({ where: { id: pool } });
    if (fresh) {
      if (usdB !== null && usdB !== undefined && Number.isFinite(usdB)) {
        fresh.dayBaseTvlUSD = (fresh.dayBaseTvlUSD ?? 0) + uiBase * usdB;
      }
      if (usdQ !== null && usdQ !== undefined && Number.isFinite(usdQ)) {
        fresh.dayQuoteTvlUSD = (fresh.dayQuoteTvlUSD ?? 0) + uiQuote * usdQ;
      }
      await this.pairRepo.save(fresh);
    }

    await this.bumpTokenLiquidityFromMint(blockTsSec, base, uiBase, usdB);
    await this.bumpTokenLiquidityFromMint(blockTsSec, quote, uiQuote, usdQ);

    const tvlUsd = pairReservesUsdNotional({
      baseAmountUi: uiBase,
      quoteAmountUi: uiQuote,
      usdPerBase:
        usdB !== null && usdB !== undefined && Number.isFinite(usdB) ? usdB : 0,
      usdPerQuote:
        usdQ !== null && usdQ !== undefined && Number.isFinite(usdQ) ? usdQ : 0,
    });
    await this.exchangeRollup.recordLiquidityTvlUsd({
      blockTs: blockTsSec,
      tvlUsdDelta: tvlUsd,
    });
  }

  private async bumpTokenLiquidityFromMint(
    blockTsSec: number,
    token: string,
    uiDelta: number,
    usdPer: number | null | undefined,
  ): Promise<void> {
    let row = await this.tokenRepo.findOne({ where: { id: token } });
    if (!row) {
      const nowSec = Math.floor(Date.now() / 1000);
      row = this.tokenRepo.create({
        id: token,
        listed: false,
        listingDate: nowSec,
      });
    }
    const dayKey = alignBucketStart(blockTsSec, '1d');
    rollSpotTokenUtcDayWindow(row, dayKey);
    row.dayTvl = (row.dayTvl ?? 0) + uiDelta;
    if (usdPer !== null && usdPer !== undefined && Number.isFinite(usdPer)) {
      row.priceUSD = usdPer;
      row.dayTvlUSD = (row.dayTvlUSD ?? 0) + uiDelta * usdPer;
    }
    await this.tokenRepo.save(row);
  }

  private async resolveTokenDecimals(token: string): Promise<number> {
    const row = await this.tokenRepo.findOne({ where: { id: token } });
    const pairDisplay = this.configService.getOrThrow<BrokerConfig['pairDisplay']>(
      'pairDisplay',
    );
    return effectiveErc20Decimals(token, row?.decimals, {
      stableQuoteAddresses: pairDisplay.stableQuoteAddresses,
    });
  }

  private weiToUiDouble(wei: bigint, decimals: number): number {
    if (wei === 0n) return 0;
    const scale = 10n ** BigInt(decimals);
    const whole = wei / scale;
    const frac = wei % scale;
    const w = Number(whole);
    const f = Number(frac) / Number(scale);
    return w + f;
  }

  /** Uniswap V3–style net liquidity at tick boundaries. */
  private async applyClTickBoundaryLiquidity(
    poolId: string,
    tickLower: number,
    tickUpperExclusive: number,
    L: bigint,
  ): Promise<void> {
    const d = L.toString();
    await this.bumpTickLiquidity(poolId, tickLower, d, d);
    await this.bumpTickLiquidity(
      poolId,
      tickUpperExclusive,
      d,
      (0n - L).toString(),
    );
  }

  private async bumpTickLiquidity(
    poolId: string,
    tickIndex: number,
    deltaGross: string,
    deltaNetSigned: string,
  ): Promise<void> {
    let row = await this.tickRepo.findOne({ where: { poolId, tickIndex } });
    if (!row) {
      row = this.tickRepo.create({
        poolId,
        tickIndex,
        liquidityGross: '0',
        liquidityNet: '0',
        feeGrowthOutside0X128: '0',
        feeGrowthOutside1X128: '0',
      });
    }
    row.liquidityGross = addNumericString(row.liquidityGross ?? '0', deltaGross);
    row.liquidityNet = (
      BigInt(row.liquidityNet ?? '0') + BigInt(deltaNetSigned)
    ).toString();
    await this.tickRepo.save(row);
  }

  private async applyClLiquidityHistogram(
    poolId: string,
    tickLower: number,
    tickUpperExclusive: number,
    L: bigint,
    payload: CLLiquidityAddedIndexerBrokerPayload,
  ): Promise<void> {
    const buckets = clHistogramBucketsForRange(
      tickLower,
      tickUpperExclusive,
      CL_HISTOGRAM_TICK_WIDTH,
    );
    if (buckets.length === 0) return;

    const blockTs = parseWireBigInt(String(payload.blockTimestamp));
    const snapshotTime = new Date(Number(blockTs) * 1000);
    const snapshotBlockNumber = parseWireBigInt(
      String(payload.blockNumber),
    ).toString();
    const Ls = L.toString();

    for (const b of buckets) {
      let row = await this.histRepo.findOne({
        where: {
          poolId,
          bucketType: 'tick',
          bucketStartTick: b.bucketStartTick,
          bucketEndTick: b.bucketEndTick,
        },
      });
      if (!row) {
        row = this.histRepo.create({
          poolId,
          bucketType: 'tick',
          bucketStartTick: b.bucketStartTick,
          bucketEndTick: b.bucketEndTick,
          priceLower: tickToDisplayPrice(b.bucketStartTick),
          priceUpper: tickToDisplayPrice(b.bucketEndTick + 1),
          liquidityAmount: '0',
          activeLiquidityAmount: '0',
          positionCount: 1,
          snapshotBlockNumber,
          snapshotTime,
        });
      }
      row.liquidityAmount = addNumericString(row.liquidityAmount, Ls);
      row.activeLiquidityAmount = row.liquidityAmount;
      row.snapshotBlockNumber = snapshotBlockNumber;
      row.snapshotTime = snapshotTime;
      row.priceLower = tickToDisplayPrice(b.bucketStartTick);
      row.priceUpper = tickToDisplayPrice(b.bucketEndTick + 1);
      await this.histRepo.save(row);
    }
  }

  private async upsertFactoryTierDefaults(
    stable: boolean,
    bps: number,
  ): Promise<void> {
    await this.factoryFeeDefaultsRepo.upsert(
      {
        id: FACTORY_FEE_DEFAULTS_ID,
        ...(stable ? { stableFeeBps: bps } : { volatileFeeBps: bps }),
      },
      ['id'],
    );
  }

  /** Apply latest factory tier bps to a new basic pair row when defaults exist. */
  private async applyFactoryTierToBasicPoolIfKnown(
    pool: string,
    stable: boolean,
  ): Promise<void> {
    const defaults = await this.factoryFeeDefaultsRepo.findOne({
      where: { id: FACTORY_FEE_DEFAULTS_ID },
    });
    if (!defaults) return;
    const bps = stable ? defaults.stableFeeBps : defaults.volatileFeeBps;
    if (bps === null || bps === undefined) return;
    await this.pairRepo.update(
      { id: pool },
      { effectiveFeeBps: bps, feeSource: 'factory_tier' },
    );
  }

  private async upsertEdge(row: {
    poolAddress: string;
    token0: string;
    token1: string;
    stable: boolean;
    isConcentratedLiquidity: boolean;
    clTickSpacing: number | null;
  }): Promise<void> {
    await this.edgeRepo.upsert(
      {
        poolAddress: row.poolAddress,
        token0: row.token0,
        token1: row.token1,
        stable: row.stable,
        isConcentratedLiquidity: row.isConcentratedLiquidity,
        clTickSpacing: row.clTickSpacing,
      },
      { conflictPaths: ['poolAddress'] },
    );
  }

  private async upsertSpotPairMinimal(args: {
    pool: string;
    token0: string;
    token1: string;
    base: string;
    quote: string;
    stable: boolean;
    isConcentratedLiquidity: boolean;
    dynamicFee?: boolean;
    effectiveFeeBps?: number | null;
    feeSource?: string | null;
    clTickSpacing?: number;
    baseDecimals?: number;
    quoteDecimals?: number;
    baseName?: string;
    quoteName?: string;
    baseSymbol?: string;
    quoteSymbol?: string;
  }): Promise<void> {
    const {
      pool,
      token0,
      token1,
      base,
      quote,
      stable,
      isConcentratedLiquidity,
      dynamicFee = false,
      effectiveFeeBps: effBpsArg,
      feeSource: feeSrcArg,
      clTickSpacing: clTs,
      baseDecimals: bd,
      quoteDecimals: qd,
      baseName: bn = '',
      quoteName: qn = '',
      baseSymbol: bs = '',
      quoteSymbol: qs = '',
    } = args;
    const type = stable ? 'stable' : 'volatile';
    const row: Partial<SpotPairEntity> = {
      id: pool,
      token0,
      token1,
      base,
      quote,
      type,
      exchange: 'giwater',
      isConcentratedLiquidity,
      dynamicFee,
      // defaults used on first insert; harmless on update
      baseSymbol: bs,
      quoteSymbol: qs,
      baseName: bn,
      quoteName: qn,
      symbol: bn && qn ? `${bn}/${qn}` : '',
      ticker: bn && qn ? `${bn}/${qn}` : '',
      description: '',
      // Do not set `listed` here — upsert would reset curator flags; new rows use DB default false.
    };
    if (effBpsArg !== undefined) {
      row.effectiveFeeBps = effBpsArg;
    }
    if (feeSrcArg !== undefined && feeSrcArg !== null) {
      row.feeSource = feeSrcArg;
    }
    if (clTs !== undefined) {
      row.clTickSpacing = clTs;
    }
    if (bd !== undefined) {
      row.bDecimal = bd;
    }
    if (qd !== undefined) {
      row.qDecimal = qd;
    }

    const existing = await this.pairRepo.findOne({ where: { id: pool } });
    if (existing) {
      this.pairRepo.merge(existing, row);
      await this.pairRepo.save(existing);
    } else {
      await this.pairRepo.save(
        this.pairRepo.create({
          ...row,
          listed: false,
        }),
      );
    }
  }

  private async normalizePersistedPairOrientation(): Promise<void> {
    const pairDisplay = this.configService.getOrThrow<BrokerConfig['pairDisplay']>(
      'pairDisplay',
    );
    const rows = await this.pairRepo.find();
    if (rows.length === 0) return;

    let changed = 0;
    for (const row of rows) {
      const desired = inferBaseQuote(row.token0, row.token1, {
        stableQuoteAddresses: pairDisplay.stableQuoteAddresses,
        wrappedNativeAddress: pairDisplay.wrappedNativeAddress || undefined,
        wrappedNativeIsQuoteWhenNoStable:
          pairDisplay.wrappedNativeIsQuoteWhenNoStable,
      });
      if (lc(row.base) === desired.base && lc(row.quote) === desired.quote) {
        continue;
      }

      const baseWasToken0 = lc(row.base) === lc(row.token0);
      const quoteWasToken1 = lc(row.quote) === lc(row.token1);
      const shouldSwap = baseWasToken0 && quoteWasToken1 && desired.base === lc(row.token1);

      row.base = desired.base;
      row.quote = desired.quote;

      if (shouldSwap) {
        [row.baseSymbol, row.quoteSymbol] = [row.quoteSymbol, row.baseSymbol];
        [row.baseName, row.quoteName] = [row.quoteName, row.baseName];
        [row.bDecimal, row.qDecimal] = [row.qDecimal, row.bDecimal];
      }
      if (row.baseName && row.quoteName) {
        const pairLabel = `${row.baseName}/${row.quoteName}`;
        row.symbol = pairLabel;
        row.ticker = pairLabel;
      }

      await this.pairRepo.save(row);
      changed += 1;
    }

    if (changed > 0) {
      this.logger.log(`Normalized ${changed} spot_pairs rows to base/quote orientation`);
    }
  }

  /** Writes token metadata when the indexer attached TokenInfo from factory/router logs. */
  private async applyTokenInfoFromIndexer(
    tokenId: string,
    tokenInfo: ParsedTokenInfo | undefined,
  ): Promise<void> {
    if (!tokenInfo) return;
    const id = lc(tokenId);
    let row = await this.tokenRepo.findOne({ where: { id } });
    if (!row) {
      const nowSec = Math.floor(Date.now() / 1000);
      row = this.tokenRepo.create({ id, listed: false, listingDate: nowSec });
    }
    if (tokenInfo.decimals !== undefined) {
      row.decimals = tokenInfo.decimals;
    }
    if (tokenInfo.name) row.name = tokenInfo.name;
    if (tokenInfo.symbol) {
      row.symbol = tokenInfo.symbol;
      row.ticker = tokenInfo.symbol;
    }
    try {
      row.totalSupply = Number(BigInt(tokenInfo.totalSupply));
    } catch {
      // keep previous totalSupply if conversion overflows JS number
    }
    await this.tokenRepo.save(row);
  }
}
