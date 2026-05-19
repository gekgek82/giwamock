import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import { DataSourceError } from "@/lib/datasources/types";
import { WagmiVoteDataSource } from "@/lib/datasources/vote/wagmi";

const VOTER = "0x0000000000000000000000000000000000000aaa" as const;
const POOL = "0x1111111111111111111111111111111111111111" as const;
const GAUGE = "0x2222222222222222222222222222222222222222" as const;
const TOKEN = "0x3333333333333333333333333333333333333333" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

interface MockClient {
  multicall: ReturnType<typeof vi.fn>;
  readContract: ReturnType<typeof vi.fn>;
}

function makeClient(): MockClient {
  return { multicall: vi.fn(), readContract: vi.fn() };
}

function asPublicClient(client: MockClient): PublicClient {
  return client as unknown as PublicClient;
}

describe("WagmiVoteDataSource.getGauge", () => {
  it("returns hasGauge: true when Voter.gauges returns a non-zero address", async () => {
    const client = makeClient();
    client.readContract
      .mockResolvedValueOnce(GAUGE)
      .mockResolvedValueOnce(true);

    const ds = new WagmiVoteDataSource(asPublicClient(client), {
      voter: VOTER,
    });
    const info = await ds.getGauge(POOL);

    expect(info).toEqual({
      gaugeAddress: GAUGE,
      hasGauge: true,
      isAlive: true,
    });
  });

  it("skips the isAlive call when no gauge exists", async () => {
    const client = makeClient();
    client.readContract.mockResolvedValueOnce(ZERO);

    const ds = new WagmiVoteDataSource(asPublicClient(client), {
      voter: VOTER,
    });
    const info = await ds.getGauge(POOL);

    expect(info).toEqual({
      gaugeAddress: null,
      hasGauge: false,
      isAlive: false,
    });
    expect(client.readContract).toHaveBeenCalledTimes(1);
  });

  it("raises NOT_READY when the voter address is missing", async () => {
    const ds = new WagmiVoteDataSource(asPublicClient(makeClient()), {});
    const err = await ds.getGauge(POOL).catch((e) => e);
    expect(err).toBeInstanceOf(DataSourceError);
    expect((err as DataSourceError).code).toBe("NOT_READY");
  });
});

describe("WagmiVoteDataSource.getGaugeData", () => {
  it("returns all four fields via multicall", async () => {
    const client = makeClient();
    client.multicall.mockResolvedValueOnce([
      { status: "success", result: 100n },
      { status: "success", result: 10_000n },
      { status: "success", result: 1_700_000_000n },
      { status: "success", result: TOKEN },
    ]);

    const ds = new WagmiVoteDataSource(asPublicClient(client), {});
    const data = await ds.getGaugeData(GAUGE);

    expect(data).toEqual({
      rewardRate: 100n,
      totalSupply: 10_000n,
      periodFinish: 1_700_000_000n,
      rewardToken: TOKEN,
    });
  });

  it("falls back to zero / zero-address on partial failure", async () => {
    const client = makeClient();
    client.multicall.mockResolvedValueOnce([
      { status: "failure" },
      { status: "success", result: 10n },
      { status: "failure" },
      { status: "failure" },
    ]);

    const ds = new WagmiVoteDataSource(asPublicClient(client), {});
    const data = await ds.getGaugeData(GAUGE);

    expect(data).toEqual({
      rewardRate: 0n,
      totalSupply: 10n,
      periodFinish: 0n,
      rewardToken: ZERO,
    });
  });
});

describe("WagmiVoteDataSource.getPoolWeight", () => {
  it("returns weight + totalWeight", async () => {
    const client = makeClient();
    client.multicall.mockResolvedValueOnce([
      { status: "success", result: 300n },
      { status: "success", result: 1_000n },
    ]);

    const ds = new WagmiVoteDataSource(asPublicClient(client), {
      voter: VOTER,
    });
    expect(await ds.getPoolWeight(POOL)).toEqual({
      weight: 300n,
      totalWeight: 1_000n,
    });
  });
});
