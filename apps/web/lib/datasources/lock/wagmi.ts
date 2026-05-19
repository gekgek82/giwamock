import type { Abi, PublicClient } from "viem";
import { VotingEscrowAbi as VotingEscrowAbiRaw } from "@giwater/shared/abis";

import { DataSourceError, type Address } from "@/lib/datasources/types";
import type { LockDataSource, RawLock } from "@/lib/datasources/lock/types";

const VotingEscrowAbi = VotingEscrowAbiRaw as Abi;

export interface LockDataSourceAddresses {
  votingEscrow?: Address;
}

/**
 * On-chain implementation of `LockDataSource`. Uses `VotingEscrow.balanceOf`
 * + `tokenOfOwnerByIndex` + `locked` + `balanceOfNFT`. Reads for all tokenIds
 * are batched through multicall to match the original hook's request count.
 */
export class WagmiLockDataSource implements LockDataSource {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly addresses: LockDataSourceAddresses,
  ) {}

  async getNFTCount(walletAddress: Address): Promise<number> {
    const ve = this.require("votingEscrow");
    const count = (await this.publicClient.readContract({
      address: ve,
      abi: VotingEscrowAbi,
      functionName: "balanceOf",
      args: [walletAddress],
    })) as bigint;
    return Number(count);
  }

  async getUserLocks(walletAddress: Address): Promise<RawLock[]> {
    const ve = this.require("votingEscrow");
    const count = await this.getNFTCount(walletAddress);
    if (count === 0) return [];

    const indexCalls = Array.from({ length: count }, (_, i) => ({
      address: ve,
      abi: VotingEscrowAbi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [walletAddress, BigInt(i)] as const,
    }));

    const idResults = await this.publicClient.multicall({
      contracts: indexCalls,
      allowFailure: true,
    });

    const tokenIds = idResults
      .filter((r) => r.status === "success")
      .map((r) => r.result as bigint);

    if (tokenIds.length === 0) return [];

    const dataCalls = tokenIds.flatMap((tokenId) => [
      {
        address: ve,
        abi: VotingEscrowAbi,
        functionName: "locked" as const,
        args: [tokenId] as const,
      },
      {
        address: ve,
        abi: VotingEscrowAbi,
        functionName: "balanceOfNFT" as const,
        args: [tokenId] as const,
      },
    ]);

    const dataResults = await this.publicClient.multicall({
      contracts: dataCalls,
      allowFailure: true,
    });

    return tokenIds.map((tokenId, i) => {
      const lockedEntry = dataResults[i * 2];
      const balanceEntry = dataResults[i * 2 + 1];
      return parseRawLock(tokenId, lockedEntry, balanceEntry);
    });
  }

  async getLockData(tokenId: bigint): Promise<RawLock | null> {
    const ve = this.require("votingEscrow");
    const [lockedEntry, balanceEntry] = await this.publicClient.multicall({
      contracts: [
        {
          address: ve,
          abi: VotingEscrowAbi,
          functionName: "locked",
          args: [tokenId],
        },
        {
          address: ve,
          abi: VotingEscrowAbi,
          functionName: "balanceOfNFT",
          args: [tokenId],
        },
      ],
      allowFailure: true,
    });

    if (lockedEntry.status !== "success") return null;
    return parseRawLock(tokenId, lockedEntry, balanceEntry);
  }

  private require(key: keyof LockDataSourceAddresses): Address {
    const value = this.addresses[key];
    if (!value) {
      throw new DataSourceError(
        `${key} address is not available`,
        "NOT_READY",
      );
    }
    return value;
  }
}

type MulticallEntry = { status: "success"; result: unknown } | { status: "failure" };

function parseRawLock(
  tokenId: bigint,
  lockedEntry: MulticallEntry | undefined,
  balanceEntry: MulticallEntry | undefined,
): RawLock {
  const locked =
    lockedEntry?.status === "success"
      ? (lockedEntry.result as readonly [bigint, bigint, boolean])
      : undefined;

  const rawAmount = locked?.[0] ?? 0n;
  const amount = rawAmount < 0n ? -rawAmount : rawAmount;
  const endTimestamp = locked?.[1] ?? 0n;
  const isPermanent = locked?.[2] ?? false;
  const votingPower =
    balanceEntry?.status === "success"
      ? (balanceEntry.result as bigint)
      : 0n;

  return { tokenId, amount, endTimestamp, isPermanent, votingPower };
}
