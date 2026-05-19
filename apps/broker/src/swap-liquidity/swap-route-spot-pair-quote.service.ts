import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm/dist/common/typeorm.decorators';
import type { SwapRouteHopDto } from '@giwater/shared';
import {
  averageFeeBpsAcrossHops,
  compoundRoutePriceImpactPercent,
  computeBasicQuote,
  computeStableQuote,
  computePriceImpactWithSpotInput,
  effectiveErc20Decimals,
  resolveSwapRouteHopFeeBps,
} from '@giwater/shared';
import { formatUnits, parseUnits } from 'viem';
import { In, Repository } from 'typeorm';
import type { BrokerConfig } from '../config/configuration';
import { BrokerPoolFactoryFeeDefaultsEntity } from '../models/config/broker-pool-factory-fee-defaults.entity';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';
import { SpotTokenEntity } from '../models/token/spot-token.entity';
import { DexUsdQuoteService } from '../pricing/dex-usd-quote.service';
import { uiDoubleToWei } from './ui-float-to-wei';

const FACTORY_FEE_DEFAULTS_ID = 'default';

function lc(addr: string): string {
  return addr.trim().toLowerCase();
}

/**
 * Estimates per-hop price impact and fee-on-input using broker `spot_pairs` only
 * (no RPC). Uses `spot_pairs.baseLiquidity` / `quoteLiquidity` as **proxy reserves** in human
 * units (incremented from indexer mints; see entity docs — not chain reserves).
 * Volatile/stable pools use constant-product math; CL hops use the same CP proxy
 * (approximate). For execution-accurate quotes, use the on-chain router / pool.
 */
@Injectable()
export class SwapRouteSpotPairQuoteService {
  private readonly logger = new Logger(SwapRouteSpotPairQuoteService.name);

  /**
   * Reference amount for spot-rate impact comparison:
   * A "small but not-too-small" reference in tokenIn units:
   *
   * - For typical 18-dec tokens: 0.000001 token (10^(decimals-6) wei).
   * - For low-dec tokens (<= 11): 0.01 token (10^(decimals-2) wei).
   *
   * Using a fixed base-unit constant breaks for non-18-decimal tokens (e.g. USDC),
   * causing spotOutput to be evaluated at an unrealistic size and often collapsing
   * impact to ~0 due to rounding.
   */
  private spotRefAmountWei(decimals: number): bigint {
    const d = Number.isFinite(decimals) ? Math.max(0, Math.floor(decimals)) : 0;
    if (d <= 0) return 1n;
    // Low-dec tokens: avoid 1-wei spot quotes that truncate to 0 output.
    if (d <= 11) {
      return 10n ** BigInt(Math.max(0, d - 2));
    }
    // High-dec tokens: use 1e-6 token.
    return 10n ** BigInt(d - 6);
  }

  constructor(
    @InjectRepository(SpotPairEntity)
    private readonly pairRepo: Repository<SpotPairEntity>,
    @InjectRepository(BrokerPoolFactoryFeeDefaultsEntity)
    private readonly factoryFeeDefaultsRepo: Repository<BrokerPoolFactoryFeeDefaultsEntity>,
    @InjectRepository(SpotTokenEntity)
    private readonly tokenRepo: Repository<SpotTokenEntity>,
    private readonly dexUsdQuote: DexUsdQuoteService,
    private readonly configService: ConfigService,
  ) {}

  async enrichHopQuotesFromSpotPairs(
    hops: SwapRouteHopDto[],
    amountInWei: bigint,
  ): Promise<void> {
    if (hops.length === 0 || amountInWei <= 0n) {
      return;
    }

    const poolIds = [...new Set(hops.map((h) => lc(h.pairAddress)))];
    const pairs = await this.pairRepo.find({ where: { id: In(poolIds) } });
    const pairByPool = new Map(pairs.map((p) => [lc(p.id), p]));

    const defaults = await this.factoryFeeDefaultsRepo.findOne({
      where: { id: FACTORY_FEE_DEFAULTS_ID },
    });

    let running = amountInWei;

    for (let hopIndex = 0; hopIndex < hops.length; hopIndex++) {
      const hop = hops[hopIndex]!;
      const pair = pairByPool.get(lc(hop.pairAddress));
      const feeBps = resolveSwapRouteHopFeeBps({
        effectiveFeeBps: pair?.effectiveFeeBps ?? null,
        poolKind: hop.poolKind,
        factoryVolatileFeeBps: defaults?.volatileFeeBps,
        factoryStableFeeBps: defaults?.stableFeeBps,
      });
      hop.feeBps = feeBps;

      hop.feeOnInputWei = ((running * BigInt(feeBps)) / 10000n).toString();

      const { reserveInWei, reserveOutWei } = this.proxyReserves(hop, pair);

      const output = this.quoteHopOutputWei({
        hop,
        pair,
        reserveInWei,
        reserveOutWei,
        feeBps,
        amountInWei: running,
        hopIndex,
        quoteContext: 'enrich',
      });
      if (output === 0n) {
        hop.priceImpactPercent = null;
        break;
      }
      const spotInputWei = (() => {
        // Use tokenIn decimals in the pair's base/quote orientation.
        const ti = lc(hop.tokenIn);
        const b = lc(pair?.base ?? '');
        const q = lc(pair?.quote ?? '');
        const decB = pair && pair.bDecimal > 0 ? pair.bDecimal : 18;
        const decQ = pair && pair.qDecimal > 0 ? pair.qDecimal : 18;
        const decIn = ti === b ? decB : ti === q ? decQ : 18;
        return this.spotRefAmountWei(decIn);
      })();
      const spotOutput = this.quoteHopOutputWei({
        hop,
        pair,
        reserveInWei,
        reserveOutWei,
        feeBps,
        amountInWei: spotInputWei,
        hopIndex,
        quoteContext: 'spot_ref',
      });

      hop.priceImpactPercent = computePriceImpactWithSpotInput(
        output,
        spotOutput,
        running,
        spotInputWei,
      );
      running = output;
    }
  }

  /**
   * Estimate route output by walking hop proxy quotes (same model as {@link enrichHopQuotesFromSpotPairs}).
   * When proxy `reserveInWei`/`reserveOutWei` are zero, volatile hops fall back to mid-price from
   * `spot_pairs.price` inside {@link quoteHopOutputWei} (logged as `hop_quote_mid_price_fallback_proxy_reserves_zero`).
   */
  async quoteRouteAmountOutWeiFromSpotPairs(
    hops: SwapRouteHopDto[],
    amountInWei: bigint,
  ): Promise<bigint> {
    if (hops.length === 0) {
      return amountInWei;
    }
    if (amountInWei <= 0n) {
      return 0n;
    }

    const poolIds = [...new Set(hops.map((h) => lc(h.pairAddress)))];
    const pairs = await this.pairRepo.find({ where: { id: In(poolIds) } });
    const pairByPool = new Map(pairs.map((p) => [lc(p.id), p]));

    const defaults = await this.factoryFeeDefaultsRepo.findOne({
      where: { id: FACTORY_FEE_DEFAULTS_ID },
    });

    let running = amountInWei;
    for (let hopIndex = 0; hopIndex < hops.length; hopIndex++) {
      const hop = hops[hopIndex]!;
      const pair = pairByPool.get(lc(hop.pairAddress));
      const feeBps = resolveSwapRouteHopFeeBps({
        effectiveFeeBps: pair?.effectiveFeeBps ?? null,
        poolKind: hop.poolKind,
        factoryVolatileFeeBps: defaults?.volatileFeeBps,
        factoryStableFeeBps: defaults?.stableFeeBps,
      });
      const { reserveInWei, reserveOutWei } = this.proxyReserves(hop, pair);
      const out = this.quoteHopOutputWei({
        hop,
        pair,
        reserveInWei,
        reserveOutWei,
        feeBps,
        amountInWei: running,
        hopIndex,
        quoteContext: 'route',
      });
      if (out === 0n) {
        return 0n;
      }
      running = out;
    }
    return running;
  }

  private quoteHopOutputWei(args: {
    hop: SwapRouteHopDto;
    pair: SpotPairEntity | undefined;
    reserveInWei: bigint;
    reserveOutWei: bigint;
    feeBps: number;
    amountInWei: bigint;
    hopIndex?: number;
    quoteContext?: 'route' | 'enrich' | 'spot_ref';
  }): bigint {
    const {
      hop,
      pair,
      reserveInWei,
      reserveOutWei,
      feeBps,
      amountInWei,
      hopIndex,
      quoteContext,
    } = args;
    const logCtx = {
      hopIndex: hopIndex ?? null,
      quoteContext: quoteContext ?? null,
      pairAddress: hop.pairAddress,
      tokenIn: hop.tokenIn,
      tokenOut: hop.tokenOut,
      poolKind: hop.poolKind,
    };
    if (!pair || amountInWei === 0n) {
      if (amountInWei !== 0n && !pair) {
        this.logSwapQuoteDebug({
          event: 'hop_quote_missing_pair_row',
          ...logCtx,
          amountInWei: amountInWei.toString(),
        });
      }
      return 0n;
    }
    if (hop.poolKind === 'stable') {
      // Stable pools need the on-chain stable invariant math, which is defined in token0/token1 space.
      const t0 = lc(pair.token0);
      const b = lc(pair.base);
      const baseIsToken0 = b === t0;
      const dec0 = BigInt(baseIsToken0 ? (pair.bDecimal || 18) : (pair.qDecimal || 18));
      const dec1 = BigInt(baseIsToken0 ? (pair.qDecimal || 18) : (pair.bDecimal || 18));
      const decimals0 = 10n ** dec0;
      const decimals1 = 10n ** dec1;

      // Reserves must be passed as token0/token1 reserves.
      // Reconstruct from `spot_pairs.baseLiquidity` / `quoteLiquidity` (proxy inventory) + baseIsToken0.
      const decB = pair.bDecimal > 0 ? pair.bDecimal : 18;
      const decQ = pair.qDecimal > 0 ? pair.qDecimal : 18;
      const baseWei = uiDoubleToWei(pair.baseLiquidity ?? 0, decB);
      const quoteWei = uiDoubleToWei(pair.quoteLiquidity ?? 0, decQ);
      const reserve0 = baseIsToken0 ? baseWei : quoteWei;
      const reserve1 = baseIsToken0 ? quoteWei : baseWei;

      const tokenInIsToken0 = lc(hop.tokenIn) === t0;
      const stableOut = computeStableQuote({
        reserve0,
        reserve1,
        decimals0,
        decimals1,
        feeBps,
        amountIn: amountInWei,
        tokenInIsToken0,
      });
      if (stableOut === 0n) {
        this.logSwapQuoteDebug({
          event: 'hop_quote_stable_zero',
          ...logCtx,
          feeBps,
          amountInWei: amountInWei.toString(),
          reserve0: reserve0.toString(),
          reserve1: reserve1.toString(),
          tokenInIsToken0,
        });
      }
      return stableOut;
    }

    // Volatile / CL proxy CP: use reserves when non-zero; otherwise mid-price from `pair.price`.
    if (reserveInWei === 0n || reserveOutWei === 0n) {
      this.logSwapQuoteDebug({
        event: 'hop_quote_mid_price_fallback_proxy_reserves_zero',
        ...logCtx,
        feeBps,
        amountInWei: amountInWei.toString(),
        reserveInWei: reserveInWei.toString(),
        reserveOutWei: reserveOutWei.toString(),
        pairPrice: pair.price,
      });
      return this.quoteVolatileHopFromMidPriceWei(hop, pair, feeBps, amountInWei, logCtx);
    }
    const cpOut = computeBasicQuote(reserveInWei, reserveOutWei, feeBps, amountInWei);
    if (cpOut === 0n) {
      this.logSwapQuoteDebug({
        event: 'hop_quote_cp_truncated_to_zero',
        ...logCtx,
        feeBps,
        amountInWei: amountInWei.toString(),
        reserveInWei: reserveInWei.toString(),
        reserveOutWei: reserveOutWei.toString(),
        pairPrice: pair.price,
      });
    }
    return cpOut;
  }

  /**
   * When proxy TVLs are still zero (no liquidity indexer events yet), approximate output using
   * `spot_pairs.price` (quote per base, maintained by swap aggregation / graph).
   */
  private quoteVolatileHopFromMidPriceWei(
    hop: SwapRouteHopDto,
    pair: SpotPairEntity,
    feeBps: number,
    amountInWei: bigint,
    ctx: {
      hopIndex?: number | null;
      quoteContext?: string | null;
      pairAddress?: string;
      tokenIn?: string;
      tokenOut?: string;
      poolKind?: string;
    } = {},
  ): bigint {
    const px = pair.price;
    if (!Number.isFinite(px) || px <= 0) {
      this.logSwapQuoteDebug({
        event: 'mid_price_invalid_pair_price',
        ...ctx,
        pairPrice: px,
        amountInWei: amountInWei.toString(),
      });
      return 0n;
    }
    const b = lc(pair.base);
    const q = lc(pair.quote);
    const ti = lc(hop.tokenIn);
    const to = lc(hop.tokenOut);
    const decB = pair.bDecimal > 0 ? pair.bDecimal : 18;
    const decQ = pair.qDecimal > 0 ? pair.qDecimal : 18;
    const decIn = ti === b ? decB : ti === q ? decQ : 18;
    const decOut = to === b ? decB : to === q ? decQ : 18;
    const feeMul = (10000 - Math.max(0, Math.min(10000, feeBps))) / 10000;
    if (feeMul <= 0) {
      this.logSwapQuoteDebug({
        event: 'mid_price_fee_mul_non_positive',
        ...ctx,
        feeBps,
        amountInWei: amountInWei.toString(),
      });
      return 0n;
    }

    let outUi: number;
    let direction: 'base_to_quote' | 'quote_to_base' | 'orientation_mismatch';
    const inUi = Number(formatUnits(amountInWei, decIn));
    if (!Number.isFinite(inUi) || inUi <= 0) {
      this.logSwapQuoteDebug({
        event: 'mid_price_invalid_amount_in_ui',
        ...ctx,
        decIn,
        amountInWei: amountInWei.toString(),
        inUi,
      });
      return 0n;
    }

    if (ti === b && to === q) {
      outUi = inUi * px * feeMul;
      direction = 'base_to_quote';
    } else if (ti === q && to === b) {
      outUi = (inUi / px) * feeMul;
      direction = 'quote_to_base';
    } else {
      direction = 'orientation_mismatch';
      this.logSwapQuoteDebug({
        event: 'mid_price_token_orientation_mismatch',
        ...ctx,
        pairBase: pair.base,
        pairQuote: pair.quote,
        hopTokenIn: hop.tokenIn,
        hopTokenOut: hop.tokenOut,
        pairPrice: px,
        amountInWei: amountInWei.toString(),
      });
      return 0n;
    }
    if (!Number.isFinite(outUi) || outUi <= 0) {
      this.logSwapQuoteDebug({
        event: 'mid_price_out_ui_non_positive',
        ...ctx,
        direction,
        pairPrice: px,
        decIn,
        decOut,
        feeBps,
        inUi,
        outUi,
      });
      return 0n;
    }
    try {
      const fixed = outUi.toFixed(decOut);
      const weiOut = parseUnits(fixed, decOut);
      if (weiOut === 0n && outUi > 0) {
        this.logSwapQuoteDebug({
          event: 'mid_price_positive_human_rounded_to_zero_wei',
          hint:
            'Expected output is below 1 wei at output-token decimals; UI should treat as zero-out swap or use on-chain quote',
          ...ctx,
          direction,
          pairPrice: px,
          decIn,
          decOut,
          feeBps,
          inUi,
          outUi,
          outUiFixed: fixed,
        });
      }
      return weiOut;
    } catch {
      this.logSwapQuoteDebug({
        event: 'mid_price_parse_units_failed',
        ...ctx,
        direction,
        outUi,
        decOut,
      });
      return 0n;
    }
  }

  /** Structured debug line for swap quote inspection (`LOG_LEVEL=debug` / Nest debug logging). */
  private logSwapQuoteDebug(payload: Record<string, unknown>): void {
    this.logger.debug(JSON.stringify({ tag: 'swap_quote', ...payload }));
  }

  /**
   * Compute route-level exchangeRate as **input / output** in human units, derived from the
   * proxy reserves (`spot_pairs.baseLiquidity/quoteLiquidity`) rather than the sized quote.
   *
   * - For a hop base->quote: hopRate = base/quote = baseLiquidity/quoteLiquidity.
   * - For a hop quote->base: hopRate = quote/base = 1 / (baseLiquidity/quoteLiquidity).
   *
   * Multi-hop composes by multiplication: (A/B) * (B/C) = (A/C).
   */
  async computeRouteExchangeRateInPerOutFromProxyReserves(
    hops: SwapRouteHopDto[],
  ): Promise<number | null> {
    if (!hops || hops.length === 0) return null;

    const poolIds = [...new Set(hops.map((h) => lc(h.pairAddress)))];
    const pairs = await this.pairRepo.find({ where: { id: In(poolIds) } });
    const pairByPool = new Map(pairs.map((p) => [lc(p.id), p]));

    let rate = 1;
    for (const hop of hops) {
      const pair = pairByPool.get(lc(hop.pairAddress));
      if (!pair) {
        return null;
      }
      const ti = lc(hop.tokenIn);
      const to = lc(hop.tokenOut);
      const b = lc(pair.base);
      const q = lc(pair.quote);
      const decB = pair.bDecimal > 0 ? pair.bDecimal : 18;
      const decQ = pair.qDecimal > 0 ? pair.qDecimal : 18;

      const { reserveInWei, reserveOutWei } = this.proxyReserves(hop, pair);
      let hopRate: number;
      if (reserveInWei === 0n || reserveOutWei === 0n) {
        const px = pair.price;
        if (!Number.isFinite(px) || px <= 0) {
          return null;
        }
        if (ti === b && to === q) {
          hopRate = 1 / px;
        } else if (ti === q && to === b) {
          hopRate = px;
        } else {
          return null;
        }
      } else {
        const decIn = ti === b ? decB : ti === q ? decQ : 18;
        const decOut = to === b ? decB : to === q ? decQ : 18;

        const inUi = Number(formatUnits(reserveInWei, decIn));
        const outUi = Number(formatUnits(reserveOutWei, decOut));
        if (!Number.isFinite(inUi) || !Number.isFinite(outUi) || inUi <= 0 || outUi <= 0) {
          return null;
        }
        hopRate = inUi / outUi;
      }
      if (!Number.isFinite(hopRate) || hopRate <= 0) return null;

      rate *= hopRate;
      if (!Number.isFinite(rate) || rate <= 0) return null;
    }

    return rate;
  }

  /**
   * Exchange rate as **from-token / to-token in human units** from the sized route quote:
   * `(amountInWei / 10^decFrom) / (amountOutWei / 10^decTo)`.
   *
   * Use when {@link computeRouteExchangeRateInPerOutFromProxyReserves} returns null (e.g. mid-price
   * orientation mismatch) while {@link quoteRouteAmountOutWeiFromSpotPairs} still produced output.
   */
  async computeRouteExchangeRateFromSizedQuoteWei(
    fromToken: string,
    toToken: string,
    amountInWei: bigint,
    amountOutWei: bigint,
  ): Promise<number | null> {
    if (amountInWei <= 0n || amountOutWei <= 0n) {
      return null;
    }
    const pairDisplay = this.configService.getOrThrow<BrokerConfig['pairDisplay']>(
      'pairDisplay',
    );
    const [fromRow, toRow] = await Promise.all([
      this.tokenRepo.findOne({ where: { id: lc(fromToken) } }),
      this.tokenRepo.findOne({ where: { id: lc(toToken) } }),
    ]);
    const decIn = effectiveErc20Decimals(lc(fromToken), fromRow?.decimals, {
      stableQuoteAddresses: pairDisplay.stableQuoteAddresses,
    });
    const decOut = effectiveErc20Decimals(lc(toToken), toRow?.decimals, {
      stableQuoteAddresses: pairDisplay.stableQuoteAddresses,
    });
    const inUi = Number(formatUnits(amountInWei, decIn));
    const outUi = Number(formatUnits(amountOutWei, decOut));
    if (!Number.isFinite(inUi) || !Number.isFinite(outUi) || outUi <= 0) {
      return null;
    }
    const rate = inUi / outUi;
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }

  /**
   * Debug helper: walk the same hop math as {@link quoteRouteAmountOutWeiFromSpotPairs},
   * returning per-hop reserve mapping + intermediate amounts.
   *
   * Intended for development diagnostics only (e.g. verifying base/quote orientation).
   */
  async debugRouteQuoteFromSpotPairs(
    hops: SwapRouteHopDto[],
    amountInWei: bigint,
  ): Promise<
    Array<{
      hopIndex: number;
      pairAddress: string;
      tokenIn: string;
      tokenOut: string;
      poolKind: string;
      feeBps: number;
      pairBase: string;
      pairQuote: string;
      bDecimal: number;
      qDecimal: number;
      baseLiquidity: number;
      quoteLiquidity: number;
      reserveInWei: string;
      reserveOutWei: string;
      runningInWei: string;
      runningOutWei: string;
    }>
  > {
    if (amountInWei <= 0n) return [];
    if (hops.length === 0) return [];

    const poolIds = [...new Set(hops.map((h) => lc(h.pairAddress)))];
    const pairs = await this.pairRepo.find({ where: { id: In(poolIds) } });
    const pairByPool = new Map(pairs.map((p) => [lc(p.id), p]));

    const defaults = await this.factoryFeeDefaultsRepo.findOne({
      where: { id: FACTORY_FEE_DEFAULTS_ID },
    });

    let running = amountInWei;
    const rows: Array<any> = [];
    for (let i = 0; i < hops.length; i++) {
      const hop = hops[i]!;
      const pair = pairByPool.get(lc(hop.pairAddress));
      const feeBps = resolveSwapRouteHopFeeBps({
        effectiveFeeBps: pair?.effectiveFeeBps ?? null,
        poolKind: hop.poolKind,
        factoryVolatileFeeBps: defaults?.volatileFeeBps,
        factoryStableFeeBps: defaults?.stableFeeBps,
      });
      const { reserveInWei, reserveOutWei } = this.proxyReserves(hop, pair);
      const out =
        reserveInWei === 0n || reserveOutWei === 0n
          ? 0n
          : computeBasicQuote(reserveInWei, reserveOutWei, feeBps, running);

      rows.push({
        hopIndex: i,
        pairAddress: hop.pairAddress,
        tokenIn: hop.tokenIn,
        tokenOut: hop.tokenOut,
        poolKind: hop.poolKind,
        feeBps,
        pairBase: pair?.base ?? '',
        pairQuote: pair?.quote ?? '',
        bDecimal: pair?.bDecimal ?? 0,
        qDecimal: pair?.qDecimal ?? 0,
        baseLiquidity: pair?.baseLiquidity ?? 0,
        quoteLiquidity: pair?.quoteLiquidity ?? 0,
        reserveInWei: reserveInWei.toString(),
        reserveOutWei: reserveOutWei.toString(),
        runningInWei: running.toString(),
        runningOutWei: out.toString(),
      });

      if (out === 0n) break;
      running = out;
    }
    return rows;
  }

  /**
   * Route-level metrics after {@link enrichHopQuotesFromSpotPairs} (requires `amountIn`).
   */
  async computeRouteAggregates(hops: SwapRouteHopDto[]): Promise<{
    totalFeeUsd: number | null;
    averageFeeBps: number | null;
    routePriceImpactPercent: number | null;
  }> {
    const averageFeeBps = averageFeeBpsAcrossHops(hops);
    const routePriceImpactPercent = compoundRoutePriceImpactPercent(
      hops.map((h) => h.priceImpactPercent),
    );

    if (hops.length === 0) {
      return {
        totalFeeUsd: 0,
        averageFeeBps,
        routePriceImpactPercent,
      };
    }

    const tokenIds = [...new Set(hops.map((h) => lc(h.tokenIn)))];
    const [usdMap, tokenRows] = await Promise.all([
      this.dexUsdQuote.resolveUsdPricesForTokens(tokenIds),
      this.tokenRepo.find({ where: { id: In(tokenIds) } }),
    ]);
    const tokenByAddr = new Map(tokenRows.map((t) => [lc(t.id), t]));
    const pairDisplay = this.configService.getOrThrow<BrokerConfig['pairDisplay']>(
      'pairDisplay',
    );

    let totalFeeUsd = 0;
    for (const hop of hops) {
      const feeWeiStr = hop.feeOnInputWei;
      if (feeWeiStr === null || feeWeiStr === undefined) {
        return {
          totalFeeUsd: null,
          averageFeeBps,
          routePriceImpactPercent,
        };
      }
      const addr = lc(hop.tokenIn);
      const usd = usdMap.get(addr);
      if (
        usd === null ||
        usd === undefined ||
        !Number.isFinite(usd) ||
        usd < 0
      ) {
        return {
          totalFeeUsd: null,
          averageFeeBps,
          routePriceImpactPercent,
        };
      }
      const row = tokenByAddr.get(addr);
      const dec = effectiveErc20Decimals(addr, row?.decimals, {
        stableQuoteAddresses: pairDisplay.stableQuoteAddresses,
      });
      const feeWei = BigInt(feeWeiStr);
      const feeUi = this.weiToUiDouble(feeWei, dec);
      totalFeeUsd += feeUi * usd;
    }

    if (!Number.isFinite(totalFeeUsd)) {
      return {
        totalFeeUsd: null,
        averageFeeBps,
        routePriceImpactPercent,
      };
    }

    return {
      totalFeeUsd,
      averageFeeBps,
      routePriceImpactPercent,
    };
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

  /**
   * Map hop direction to proxy reserves, being explicit about base/quote vs token0/token1.
   *
   * `spot_pairs.baseLiquidity/quoteLiquidity` are stored in **base/quote token units**, but BASIC pool math
   * (and our graph hops) are naturally expressed as **tokenIn/tokenOut** for that swap direction.
   *
   * To avoid any accidental inversion when base/quote differs from on-chain token0/token1,
   * we first project base/quote TVLs onto token0/token1 reserves, then select reserves by hop direction.
   */
  private proxyReserves(
    hop: SwapRouteHopDto,
    pair: SpotPairEntity | undefined,
  ): { reserveInWei: bigint; reserveOutWei: bigint } {
    if (!pair) {
      return { reserveInWei: 0n, reserveOutWei: 0n };
    }

    const ti = lc(hop.tokenIn);
    const to = lc(hop.tokenOut);

    const b = lc(pair.base);
    const q = lc(pair.quote);
    if (!b || !q) {
      return { reserveInWei: 0n, reserveOutWei: 0n };
    }

    const decB = pair.bDecimal > 0 ? pair.bDecimal : 18;
    const decQ = pair.qDecimal > 0 ? pair.qDecimal : 18;
    const baseWei = uiDoubleToWei(pair.baseLiquidity ?? 0, decB);
    const quoteWei = uiDoubleToWei(pair.quoteLiquidity ?? 0, decQ);

    // Prefer display base/quote mapping first — works even when `token0`/`token1` were never
    // backfilled on legacy rows (swap-first spot_pairs inserts).
    if (ti === b && to === q) {
      return { reserveInWei: baseWei, reserveOutWei: quoteWei };
    }
    if (ti === q && to === b) {
      return { reserveInWei: quoteWei, reserveOutWei: baseWei };
    }

    const t0 = lc(pair.token0);
    const t1 = lc(pair.token1);
    if (!t0 || !t1) {
      return { reserveInWei: 0n, reserveOutWei: 0n };
    }

    const baseIsToken0 = b === t0;
    const token0Wei = baseIsToken0 ? baseWei : quoteWei;
    const token1Wei = baseIsToken0 ? quoteWei : baseWei;

    if (ti === t0 && to === t1) {
      return { reserveInWei: token0Wei, reserveOutWei: token1Wei };
    }
    if (ti === t1 && to === t0) {
      return { reserveInWei: token1Wei, reserveOutWei: token0Wei };
    }

    return { reserveInWei: 0n, reserveOutWei: 0n };
  }
}
