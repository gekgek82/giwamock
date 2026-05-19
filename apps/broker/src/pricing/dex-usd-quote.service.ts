import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { DexPairPriceInput, DexUsdQuoteConfig } from '@giwater/shared';
import {
  resolveDexTokenUsdPrice,
  resolveWethUsdPrice,
} from '@giwater/shared';
import { Repository } from 'typeorm';
import type { BrokerConfig } from '../config/configuration';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';

function lc(addr: string): string {
  return addr.trim().toLowerCase();
}

/**
 * Loads `spot_pairs` and applies `@giwater/shared` `resolveDexTokenUsdPrice` /
 * `resolveWethUsdPrice` using `DEX_USD_QUOTE_USDT` and `DEX_USD_QUOTE_WETH`.
 */
@Injectable()
export class DexUsdQuoteService {
  private readonly logger = new Logger(DexUsdQuoteService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SpotPairEntity)
    private readonly pairRepo: Repository<SpotPairEntity>,
  ) {}

  private get cfg(): DexUsdQuoteConfig | null {
    const c = this.configService.getOrThrow<BrokerConfig['dexUsdQuote']>(
      'dexUsdQuote',
    );
    if (!c.usdtToken || !c.wethToken) return null;
    return { usdtToken: lc(c.usdtToken), wethToken: lc(c.wethToken) };
  }

  /**
   * All pairs with a positive last `price` (quote per base), for USD routing.
   */
  async loadPairPriceInputs(): Promise<DexPairPriceInput[]> {
    const rows = await this.pairRepo.find({
      select: ['id', 'base', 'quote', 'price'],
    });
    const out: DexPairPriceInput[] = [];
    for (const r of rows) {
      if (
        typeof r.price === 'number' &&
        Number.isFinite(r.price) &&
        r.price > 0 &&
        r.base &&
        r.quote
      ) {
        out.push({
          poolAddress: lc(r.id),
          base: lc(r.base),
          quote: lc(r.quote),
          price: r.price,
        });
      }
    }
    return out;
  }

  async getWethUsdPrice(): Promise<number | null> {
    const c = this.cfg;
    if (!c) return null;
    const pairs = await this.loadPairPriceInputs();
    return resolveWethUsdPrice(pairs, c);
  }

  /**
   * USD per 1 token, or `null` if quote addresses are unset or no route.
   */
  async getTokenUsdPrice(tokenAddress: string): Promise<number | null> {
    const m = await this.resolveUsdPricesForTokens([tokenAddress]);
    return m.get(lc(tokenAddress)) ?? null;
  }

  /**
   * One DB read of pair rows; resolves USD for each unique token (lowercased keys).
   */
  async resolveUsdPricesForTokens(
    tokens: string[],
  ): Promise<Map<string, number | null>> {
    const out = new Map<string, number | null>();
    const c = this.cfg;
    if (!c) {
      for (const t of tokens) {
        if (t) out.set(lc(t), null);
      }
      return out;
    }
    const pairs = await this.loadPairPriceInputs();
    const uniq = [...new Set(tokens.map((t) => lc(t)).filter((t) => t.length > 0))];
    for (const t of uniq) {
      out.set(t, resolveDexTokenUsdPrice(t, pairs, c));
    }
    return out;
  }
}
