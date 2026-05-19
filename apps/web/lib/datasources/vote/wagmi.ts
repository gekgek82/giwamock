import type { Abi, PublicClient } from "viem";
import {
  GaugeAbi as GaugeAbiRaw,
  VoterAbi as VoterAbiRaw,
} from "@giwater/shared/abis";

import { DataSourceError, type Address } from "@/lib/datasources/types";
import type {
  GaugeData,
  GaugeInfo,
  PoolWeight,
  VoteDataSource,
} from "@/lib/datasources/vote/types";

const VoterAbi = VoterAbiRaw as Abi;
const GaugeAbi = GaugeAbiRaw as Abi;

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

export interface VoteDataSourceAddresses {
  voter?: Address;
}

/**
 * On-chain implementation of `VoteDataSource`. Reads `Voter.gauges`,
 * `Voter.isAlive`, `Voter.weights`, `Voter.totalWeight`, and the gauge's
 * own `rewardRate`/`totalSupply`/`periodFinish`/`rewardToken`.
 */
export class WagmiVoteDataSource implements VoteDataSource {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly addresses: VoteDataSourceAddresses,
  ) {}

  async getGauge(poolAddress: Address): Promise<GaugeInfo> {
    const voter = this.require("voter");

    const gauge = (await this.publicClient.readContract({
      address: voter,
      abi: VoterAbi,
      functionName: "gauges",
      args: [poolAddress],
    })) as Address;

    const hasGauge = !!gauge && gauge !== ZERO_ADDRESS;
    if (!hasGauge) {
      return { gaugeAddress: null, hasGauge: false, isAlive: false };
    }

    const isAlive = (await this.publicClient.readContract({
      address: voter,
      abi: VoterAbi,
      functionName: "isAlive",
      args: [gauge],
    })) as boolean;

    return { gaugeAddress: gauge, hasGauge: true, isAlive };
  }

  async getGaugeData(gaugeAddress: Address): Promise<GaugeData> {
    const [rewardRate, totalSupply, periodFinish, rewardToken] =
      await this.publicClient.multicall({
        contracts: [
          {
            address: gaugeAddress,
            abi: GaugeAbi,
            functionName: "rewardRate",
          },
          {
            address: gaugeAddress,
            abi: GaugeAbi,
            functionName: "totalSupply",
          },
          {
            address: gaugeAddress,
            abi: GaugeAbi,
            functionName: "periodFinish",
          },
          {
            address: gaugeAddress,
            abi: GaugeAbi,
            functionName: "rewardToken",
          },
        ],
        allowFailure: true,
      });

    return {
      rewardRate:
        rewardRate.status === "success" ? (rewardRate.result as bigint) : 0n,
      totalSupply:
        totalSupply.status === "success" ? (totalSupply.result as bigint) : 0n,
      periodFinish:
        periodFinish.status === "success"
          ? (periodFinish.result as bigint)
          : 0n,
      rewardToken:
        rewardToken.status === "success"
          ? (rewardToken.result as Address)
          : ZERO_ADDRESS,
    };
  }

  async getPoolWeight(poolAddress: Address): Promise<PoolWeight> {
    const voter = this.require("voter");
    const [weight, totalWeight] = await this.publicClient.multicall({
      contracts: [
        {
          address: voter,
          abi: VoterAbi,
          functionName: "weights",
          args: [poolAddress],
        },
        {
          address: voter,
          abi: VoterAbi,
          functionName: "totalWeight",
        },
      ],
      allowFailure: true,
    });

    return {
      weight: weight.status === "success" ? (weight.result as bigint) : 0n,
      totalWeight:
        totalWeight.status === "success"
          ? (totalWeight.result as bigint)
          : 0n,
    };
  }

  private require(key: keyof VoteDataSourceAddresses): Address {
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
