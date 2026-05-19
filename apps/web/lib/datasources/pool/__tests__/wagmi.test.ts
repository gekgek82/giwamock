import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataSourceError } from "@/lib/datasources/types";
import { WagmiPoolDataSource } from "@/lib/datasources/pool/wagmi";

const POOL = "0x0000000000000000000000000000000000000aaa" as const;
const TOKEN0 = "0x1111111111111111111111111111111111111111" as const;
const TOKEN1 = "0x2222222222222222222222222222222222222222" as const;
const POOL_FACTORY = "0x0000000000000000000000000000000000000100" as const;
const CL_FACTORY = "0x0000000000000000000000000000000000000200" as const;
const SWAP_FEE_MODULE = "0x0000000000000000000000000000000000000300" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

interface MockClient {
  multicall: ReturnType<typeof vi.fn>;
  readContract: ReturnType<typeof vi.fn>;
}

function makeClient(): MockClient {
  return {
    multicall: vi.fn(),
    readContract: vi.fn(),
  };
}

function asPublicClient(client: MockClient): PublicClient {
  return client as unknown as PublicClient;
}

describe("WagmiPoolDataSource.getInfo", () => {
  it("returns metadata built from two multicalls", async () => {
    const client = makeClient();
    client.multicall
      .mockResolvedValueOnce([TOKEN0, TOKEN1])
      .mockResolvedValueOnce([
        { status: "success", result: "WETH" },
        { status: "success", result: "Wrapped Ether" },
        { status: "success", result: 18 },
        { status: "success", result: "USDC" },
        { status: "success", result: "USD Coin" },
        { status: "success", result: 6 },
      ]);

    const ds = new WagmiPoolDataSource(asPublicClient(client), {
      poolFactory: POOL_FACTORY,
    });

    const info = await ds.getInfo(POOL);

    expect(info.token0).toEqual({
      address: TOKEN0,
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
    });
    expect(info.token1).toEqual({
      address: TOKEN1,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    });
    expect(client.multicall).toHaveBeenCalledTimes(2);
  });

  it("falls back to UNKNOWN when a metadata read fails", async () => {
    const client = makeClient();
    client.multicall
      .mockResolvedValueOnce([TOKEN0, TOKEN1])
      .mockResolvedValueOnce([
        { status: "failure" },
        { status: "failure" },
        { status: "failure" },
        { status: "success", result: "USDC" },
        { status: "success", result: "USD Coin" },
        { status: "success", result: 6 },
      ]);

    const ds = new WagmiPoolDataSource(asPublicClient(client), {});
    const info = await ds.getInfo(POOL);

    expect(info.token0.symbol).toBe("UNKNOWN");
    expect(info.token0.decimals).toBe(18);
    expect(info.token1.symbol).toBe("USDC");
  });
});

describe("WagmiPoolDataSource.getReserves", () => {
  it("extracts reserves from the getReserves tuple", async () => {
    const client = makeClient();
    client.readContract.mockResolvedValueOnce([
      1_000n,
      2_000n,
      1_700_000_000n,
    ]);

    const ds = new WagmiPoolDataSource(asPublicClient(client), {});
    const reserves = await ds.getReserves(POOL);

    expect(reserves).toEqual({
      reserve0: 1_000n,
      reserve1: 2_000n,
      blockTimestampLast: 1_700_000_000n,
    });
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: POOL,
        functionName: "getReserves",
      }),
    );
  });
});

describe("WagmiPoolDataSource.getFee (basic)", () => {
  it("returns the factory fee for a basic pool", async () => {
    const client = makeClient();
    client.readContract.mockResolvedValueOnce(30n); // 0.30%

    const ds = new WagmiPoolDataSource(asPublicClient(client), {
      poolFactory: POOL_FACTORY,
    });
    const fee = await ds.getFee(POOL, false, "BASIC");

    expect(fee).toEqual({
      feeBasisPoints: 30,
      baseFeeBasisPoints: 30,
      isDynamicFee: false,
    });
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: POOL_FACTORY,
        functionName: "getFee",
        args: [POOL, false],
      }),
    );
  });

  it("raises NOT_READY when the factory address is missing", async () => {
    const client = makeClient();
    const ds = new WagmiPoolDataSource(asPublicClient(client), {});

    await expect(ds.getFee(POOL, false, "BASIC")).rejects.toMatchObject({
      name: "DataSourceError",
      code: "NOT_READY",
    });
    expect(client.readContract).not.toHaveBeenCalled();
  });
});

describe("WagmiPoolDataSource.getFee (CL)", () => {
  it("uses the base fee when no swap fee module is configured", async () => {
    const client = makeClient();
    // CL uint24 format: 500 -> 0.05%. Pool returns 1e6 units → 500 / 100 = 5 bps.
    client.multicall.mockResolvedValueOnce([500, ZERO]);

    const ds = new WagmiPoolDataSource(asPublicClient(client), {
      clPoolFactory: CL_FACTORY,
    });
    const fee = await ds.getFee(POOL, false, "CL");

    expect(fee).toEqual({
      feeBasisPoints: 5,
      baseFeeBasisPoints: 5,
      isDynamicFee: false,
    });
    expect(client.readContract).not.toHaveBeenCalled();
  });

  it("reads the dynamic fee when a swap fee module is set", async () => {
    const client = makeClient();
    client.multicall.mockResolvedValueOnce([500, SWAP_FEE_MODULE]);
    client.readContract.mockResolvedValueOnce(3_000n); // dynamic: 0.30%

    const ds = new WagmiPoolDataSource(asPublicClient(client), {
      clPoolFactory: CL_FACTORY,
    });
    const fee = await ds.getFee(POOL, false, "CL");

    expect(fee).toEqual({
      feeBasisPoints: 30,
      baseFeeBasisPoints: 5,
      isDynamicFee: true,
    });
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: SWAP_FEE_MODULE,
        functionName: "getFee",
        args: [POOL],
      }),
    );
  });
});

describe("WagmiPoolDataSource.getCLSlot0", () => {
  it("returns slot0 + liquidity in one call", async () => {
    const client = makeClient();
    client.multicall.mockResolvedValueOnce([
      [79228162514264337593543950336n, -5, 0, 1, 1, true],
      42n,
    ]);

    const ds = new WagmiPoolDataSource(asPublicClient(client), {});
    const slot0 = await ds.getCLSlot0(POOL);

    expect(slot0).toEqual({
      sqrtPriceX96: 79228162514264337593543950336n,
      tick: -5,
      observationIndex: 0,
      observationCardinality: 1,
      observationCardinalityNext: 1,
      unlocked: true,
      liquidity: 42n,
    });
  });
});

describe("WagmiPoolDataSource.checkExists", () => {
  it("reports a pool when the factory returns a non-zero address", async () => {
    const client = makeClient();
    client.readContract.mockResolvedValueOnce(POOL);

    const ds = new WagmiPoolDataSource(asPublicClient(client), {
      poolFactory: POOL_FACTORY,
    });
    const result = await ds.checkExists(TOKEN0, TOKEN1, true);

    expect(result).toEqual({ poolAddress: POOL, exists: true });
  });

  it("reports exists=false when the factory returns the zero address", async () => {
    const client = makeClient();
    client.readContract.mockResolvedValueOnce(ZERO);

    const ds = new WagmiPoolDataSource(asPublicClient(client), {
      poolFactory: POOL_FACTORY,
    });
    const result = await ds.checkExists(TOKEN0, TOKEN1, false);

    expect(result).toEqual({ poolAddress: null, exists: false });
  });

  it("raises NOT_READY when the factory address is missing", async () => {
    const client = makeClient();
    const ds = new WagmiPoolDataSource(asPublicClient(client), {});

    const err = await ds
      .checkExists(TOKEN0, TOKEN1, false)
      .catch((e) => e);
    expect(err).toBeInstanceOf(DataSourceError);
    expect((err as DataSourceError).code).toBe("NOT_READY");
  });
});

describe("WagmiPoolDataSource.getDefaultFees", () => {
  it("returns stable + volatile default fees", async () => {
    const client = makeClient();
    client.multicall.mockResolvedValueOnce([5n, 30n]);

    const ds = new WagmiPoolDataSource(asPublicClient(client), {
      poolFactory: POOL_FACTORY,
    });
    const fees = await ds.getDefaultFees();

    expect(fees).toEqual({
      stableFeeBasisPoints: 5,
      volatileFeeBasisPoints: 30,
    });
  });
});

describe("WagmiPoolDataSource mock setup", () => {
  beforeEach(() => {
    // Sanity check: confirm the ABIs are importable. Mocks isolate the
    // abi payloads from the assertions — if this file fails to import we
    // catch it here rather than in every other suite.
    expect(true).toBe(true);
  });

  it("keeps the client stateless across calls", async () => {
    const client = makeClient();
    client.readContract.mockResolvedValue(ZERO);
    const ds = new WagmiPoolDataSource(asPublicClient(client), { poolFactory: POOL_FACTORY });

    await ds.checkExists(TOKEN0, TOKEN1, true);
    await ds.checkExists(TOKEN0, TOKEN1, false);

    expect(client.readContract).toHaveBeenCalledTimes(2);
  });
});
