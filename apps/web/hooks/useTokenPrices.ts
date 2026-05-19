/**
 * Token Prices Hook
 *
 * Merges USD prices from the indexer API with broker `spot_tokens` catalog prices
 * (via the same-origin gateway proxy) so TVL and fee math work when the indexer
 * omits a symbol or is unavailable.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SpotTokenRecordDto } from '@giwater/shared';
import {
  useAllTokenPrices as useAllTokenPricesFromIndexer,
  useTokenPriceFromIndexer,
} from '@/hooks/useIndexerStats';
import { isIndexerConfigured } from '@/lib/indexerApi';
import type { TokenPrice, TokenPricesResponse } from '@/types/indexer';
import {
  gatewayBrokerApi,
  GatewayBrokerApiError,
} from '@/lib/gatewayBrokerApi';
import { isGatewayConfigured } from '@/lib/config';

function bestCatalogUsdForSymbol(
  items: SpotTokenRecordDto[],
  symbol: string,
): number {
  const u = symbol.trim().toUpperCase();
  let best = 0;
  for (const r of items) {
    if (!r?.symbol || r.symbol.toUpperCase() !== u) continue;
    const p = Number.isFinite(r.priceUSD) ? r.priceUSD : 0;
    if (p > best) best = p;
  }
  return best;
}

// ============================================================================
// Re-exports
// ============================================================================

export {
  useAllTokenPrices,
  useTokenPriceFromIndexer,
} from '@/hooks/useIndexerStats';

export type { TokenPrice, TokenPricesResponse };

// ============================================================================
// Token Prices Hooks
// ============================================================================

export interface TokenPricesResult {
  prices: Record<string, number>;
  isLoading: boolean;
  error: Error | null;
  isMockData: boolean;
  refetch: () => void;
}

/**
 * Hook to get USD prices for multiple tokens by symbol
 *
 * Merges indexer token prices with broker `spot_tokens` (gateway) when the indexer
 * has no row or price is zero. `isMockData` is true only when loading finished and
 * no requested symbol resolved to a positive USD price from either source.
 */
export function useTokenPrices(symbols: (string | undefined)[]): TokenPricesResult {
  const validSymbols = symbols.filter((s): s is string => !!s);

  const symbolsFingerprint = validSymbols
    .map((s) => s.trim().toLowerCase())
    .sort()
    .join('\x1e');

  const validKey = validSymbols.map((s) => s.trim()).join('\x1e');

  const uniqueSymbols = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of validSymbols) {
      const t = s.trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out;
  }, [validKey]);

  const indexerQuery = useAllTokenPricesFromIndexer({
    enabled: validSymbols.length > 0,
  });

  const gatewayPricesQuery = useQuery({
    queryKey: ['gateway', 'spot-token-prices-by-symbol', symbolsFingerprint],
    queryFn: async (): Promise<Record<string, number>> => {
      const out: Record<string, number> = {};
      if (!isGatewayConfigured() || uniqueSymbols.length === 0) return out;
      await Promise.all(
        uniqueSymbols.map(async (symbol) => {
          const key = symbol.trim().toLowerCase();
          try {
            const resp = await gatewayBrokerApi.getSpotTokensBySymbol(symbol);
            out[key] = bestCatalogUsdForSymbol(resp.items ?? [], symbol);
          } catch (e) {
            if (e instanceof GatewayBrokerApiError && e.statusCode === 404) {
              out[key] = 0;
              return;
            }
            throw e;
          }
        }),
      );
      return out;
    },
    enabled: validSymbols.length > 0 && isGatewayConfigured(),
    staleTime: 60_000,
  });

  const result = useMemo(() => {
    const gw = gatewayPricesQuery.data ?? {};
    const indexerTokens = indexerQuery.data?.tokens;

    const filteredPrices: Record<string, number> = {};
    for (const symbol of validSymbols) {
      const trimmed = symbol.trim();
      const upperSymbol = trimmed.toUpperCase();
      let price = 0;

      if (indexerTokens) {
        for (const token of indexerTokens) {
          if (
            token.symbol.toUpperCase() === upperSymbol ||
            token.symbol === trimmed
          ) {
            price = parseFloat(token.priceUSD) || 0;
            break;
          }
        }
      }

      if (price <= 0) {
        price = gw[trimmed.toLowerCase()] ?? 0;
      }
      filteredPrices[symbol] = price;
    }

    const stillLoading =
      indexerQuery.isLoading || gatewayPricesQuery.isLoading;
    const hasRealPrice = validSymbols.some((s) => (filteredPrices[s] ?? 0) > 0);
    const isMockData =
      validSymbols.length > 0 && !stillLoading && !hasRealPrice;

    return {
      prices: filteredPrices,
      isMockData,
    };
  }, [
    indexerQuery.data,
    indexerQuery.isLoading,
    gatewayPricesQuery.data,
    gatewayPricesQuery.isLoading,
    validSymbols,
  ]);

  return {
    prices: result.prices,
    isLoading: indexerQuery.isLoading || gatewayPricesQuery.isLoading,
    error: indexerQuery.error ?? gatewayPricesQuery.error ?? null,
    isMockData: result.isMockData,
    refetch: () => {
      void indexerQuery.refetch();
      void gatewayPricesQuery.refetch();
    },
  };
}

/**
 * Hook to get USD price for a single token by symbol
 *
 * @param symbol - Token symbol
 * @returns Price value and loading state
 *
 * @example
 * ```tsx
 * function TokenPrice({ symbol }) {
 *   const { price, isLoading } = useTokenPrice(symbol);
 *
 *   if (isLoading) return <Skeleton />;
 *
 *   return <span>${price.toFixed(2)}</span>;
 * }
 * ```
 */
export function useTokenPrice(symbol?: string): {
  price: number;
  isLoading: boolean;
  error: Error | null;
  isMockData: boolean;
} {
  const { prices, isLoading, error, isMockData } = useTokenPrices(
    symbol ? [symbol] : []
  );

  return {
    price: symbol ? (prices[symbol] ?? 0) : 0,
    isLoading,
    error,
    isMockData,
  };
}

/**
 * Hook to get AERO token price
 * Used for Emission APR calculations
 */
export function useAeroPrice() {
  return useTokenPrice('AERO');
}

// ============================================================================
// Token Prices by Address Hooks
// ============================================================================

export interface TokenPricesByAddressResult {
  prices: Record<string, number>;
  isLoading: boolean;
  error: Error | null;
  isMockData: boolean;
  refetch: () => void;
}

/**
 * Hook to get USD prices for tokens by address
 *
 * @param addresses - Array of token addresses
 * @returns Prices record (address -> USD price)
 */
export function useTokenPricesByAddress(
  addresses: (string | undefined)[]
): TokenPricesByAddressResult {
  const validAddresses = useMemo(
    () => addresses.filter((a): a is string => !!a),
    [addresses]
  );

  const indexerQuery = useAllTokenPricesFromIndexer({
    enabled: validAddresses.length > 0,
  });

  const result = useMemo(() => {
    if (indexerQuery.data) {
      // Convert to address -> price map
      const prices: Record<string, number> = {};
      for (const token of indexerQuery.data.tokens) {
        prices[token.address.toLowerCase()] = parseFloat(token.priceUSD) || 0;
      }
      // Map requested addresses
      const filteredPrices: Record<string, number> = {};
      for (const address of validAddresses) {
        filteredPrices[address] = prices[address.toLowerCase()] ?? 0;
      }
      return {
        prices: filteredPrices,
        isMockData: !isIndexerConfigured(),
      };
    }

    return {
      prices: {} as Record<string, number>,
      isMockData: !isIndexerConfigured(),
    };
  }, [indexerQuery.data, validAddresses]);

  return {
    prices: result.prices,
    isLoading: indexerQuery.isLoading,
    error: indexerQuery.error ?? null,
    isMockData: result.isMockData,
    refetch: indexerQuery.refetch,
  };
}

/**
 * Hook to get USD price for a single token by address
 *
 * @param tokenAddress - Token contract address
 * @returns Price value and loading state
 */
export function useTokenPriceByAddress(tokenAddress?: string): {
  price: number;
  isLoading: boolean;
  error: Error | null;
  isMockData: boolean;
} {
  const query = useTokenPriceFromIndexer(tokenAddress, {
    enabled: !!tokenAddress,
  });

  return {
    price: query.data ? parseFloat(query.data.priceUSD) || 0 : 0,
    isLoading: query.isLoading,
    error: query.error ?? null,
    isMockData: !isIndexerConfigured(),
  };
}
