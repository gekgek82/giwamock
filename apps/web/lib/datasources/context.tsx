"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePublicClient } from "wagmi";

import {
  useClPoolFactoryAddress,
  usePoolFactoryAddress,
  useRouterAddress,
  useVoterAddress,
  useVotingEscrowAddress,
} from "@/hooks/useContractAddresses";
import {
  WagmiPoolDataSource,
  type PoolDataSource,
} from "@/lib/datasources/pool";
import {
  WagmiTokenDataSource,
  type TokenDataSource,
} from "@/lib/datasources/token";
import {
  WagmiLockDataSource,
  type LockDataSource,
} from "@/lib/datasources/lock";
import {
  WagmiVoteDataSource,
  type VoteDataSource,
} from "@/lib/datasources/vote";
import {
  WagmiPermit2DataSource,
  type Permit2DataSource,
} from "@/lib/datasources/permit2";
import {
  WagmiSwapDataSource,
  type SwapDataSource,
} from "@/lib/datasources/swap";
import { MOCK_DATA_ENABLED } from "@/lib/config";
import {
  MockLockDataSource,
  MockPermit2DataSource,
  MockPoolDataSource,
  MockSwapDataSource,
  MockTokenDataSource,
  MockVoteDataSource,
} from "@/lib/datasources/mock";

/**
 * Root registry of every read-only data source exposed to the app.
 *
 * Today all fields are backed by a wagmi/viem implementation. When a
 * gateway API becomes available, we swap the implementation at this one
 * provider — hooks keep calling the same interface.
 */
export interface DataSources {
  pool: PoolDataSource;
  token: TokenDataSource;
  lock: LockDataSource;
  vote: VoteDataSource;
  permit2: Permit2DataSource;
  swap: SwapDataSource;
}

const DataSourceContext = createContext<DataSources | null>(null);

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const publicClient = usePublicClient();
  const poolFactory = usePoolFactoryAddress();
  const clPoolFactory = useClPoolFactoryAddress();
  const votingEscrow = useVotingEscrowAddress();
  const voter = useVoterAddress();
  const router = useRouterAddress();

  const sources = useMemo<DataSources | null>(() => {
    if (MOCK_DATA_ENABLED) {
      return {
        pool: new MockPoolDataSource(),
        token: new MockTokenDataSource(),
        lock: new MockLockDataSource(),
        vote: new MockVoteDataSource(),
        permit2: new MockPermit2DataSource(),
        swap: new MockSwapDataSource(),
      };
    }

    if (!publicClient) return null;
    return {
      pool: new WagmiPoolDataSource(publicClient, {
        poolFactory,
        clPoolFactory,
      }),
      token: new WagmiTokenDataSource(publicClient),
      lock: new WagmiLockDataSource(publicClient, { votingEscrow }),
      vote: new WagmiVoteDataSource(publicClient, { voter }),
      permit2: new WagmiPermit2DataSource(publicClient),
      swap: new WagmiSwapDataSource(publicClient, {
        router,
        poolFactory,
      }),
    };
  }, [
    publicClient,
    poolFactory,
    clPoolFactory,
    votingEscrow,
    voter,
    router,
  ]);

  return (
    <DataSourceContext.Provider value={sources}>
      {children}
    </DataSourceContext.Provider>
  );
}

/**
 * Access the full data source registry. Returns `null` on SSR or until
 * the wagmi public client is ready. Hooks should gate their React Query
 * call on a non-null result.
 */
export function useDataSources(): DataSources | null {
  return useContext(DataSourceContext);
}

export function usePoolDataSource(): PoolDataSource | null {
  return useDataSources()?.pool ?? null;
}

export function useTokenDataSource(): TokenDataSource | null {
  return useDataSources()?.token ?? null;
}

export function useLockDataSource(): LockDataSource | null {
  return useDataSources()?.lock ?? null;
}

export function useVoteDataSource(): VoteDataSource | null {
  return useDataSources()?.vote ?? null;
}

export function usePermit2DataSource(): Permit2DataSource | null {
  return useDataSources()?.permit2 ?? null;
}

export function useSwapDataSource(): SwapDataSource | null {
  return useDataSources()?.swap ?? null;
}
