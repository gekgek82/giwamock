/**
 * Token Price API Client
 *
 * Provides token price data for TVL and APR calculations
 * by fetching real prices from the backend indexer API.
 *
 * Note: For React components, prefer using the `useTokenPrices` hook instead.
 * This module is for non-React contexts (e.g. server-side, utility scripts).
 */

import { indexerApi, isIndexerConfigured } from '@/lib/indexerApi';

// Cache for prices with TTL
interface PriceCache {
  prices: Record<string, number>;
  timestamp: number;
}

let priceCache: PriceCache | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Get token prices for a list of symbols from the backend API
 * @param symbols - Array of token symbols
 * @returns Record of symbol to USD price
 */
export async function getTokenPrices(symbols: string[]): Promise<Record<string, number>> {
  // Check cache
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL_MS) {
    const cachedPrices: Record<string, number> = {};
    let allCached = true;

    for (const symbol of symbols) {
      if (symbol in priceCache.prices) {
        cachedPrices[symbol] = priceCache.prices[symbol];
      } else {
        allCached = false;
        break;
      }
    }

    if (allCached) {
      return cachedPrices;
    }
  }

  // Fetch from backend API
  try {
    const response = await indexerApi.getAllTokenPrices();
    const allPrices: Record<string, number> = {};

    for (const token of response.tokens) {
      allPrices[token.symbol.toUpperCase()] = parseFloat(token.priceUSD) || 0;
    }

    // Update cache with all fetched prices
    priceCache = {
      prices: allPrices,
      timestamp: Date.now(),
    };

    // Return only requested symbols
    const prices: Record<string, number> = {};
    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();
      prices[symbol] = allPrices[upperSymbol] ?? allPrices[symbol] ?? 0;
    }

    return prices;
  } catch {
    // On API failure, return zeros
    const prices: Record<string, number> = {};
    for (const symbol of symbols) {
      prices[symbol] = 0;
    }
    return prices;
  }
}

/**
 * Get price for a single token
 * @param symbol - Token symbol
 * @returns USD price or 0 if not found
 */
export async function getTokenPrice(symbol: string): Promise<number> {
  const prices = await getTokenPrices([symbol]);
  return prices[symbol] ?? 0;
}

/**
 * Get AERO token price
 * Used for Emission APR calculations
 * @returns AERO price in USD
 */
export async function getAeroPrice(): Promise<number> {
  return getTokenPrice('AERO');
}

/**
 * Check if we're using mock prices
 */
export function isUsingMockPrices(): boolean {
  return !isIndexerConfigured();
}

/**
 * Clear the price cache
 * Useful for forcing a refresh
 */
export function clearPriceCache(): void {
  priceCache = null;
}
