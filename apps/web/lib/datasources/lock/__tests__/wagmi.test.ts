import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import { DataSourceError } from "@/lib/datasources/types";
import { WagmiLockDataSource } from "@/lib/datasources/lock/wagmi";

const VE = "0x0000000000000000000000000000000000000aaa" as const;
const WALLET = "0x1111111111111111111111111111111111111111" as const;

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

describe("WagmiLockDataSource.getNFTCount", () => {
  it("reads balanceOf for the wallet", async () => {
    const client = makeClient();
    client.readContract.mockResolvedValueOnce(2n);

    const ds = new WagmiLockDataSource(asPublicClient(client), {
      votingEscrow: VE,
    });
    expect(await ds.getNFTCount(WALLET)).toBe(2);
  });

  it("raises NOT_READY when the votingEscrow address is missing", async () => {
    const ds = new WagmiLockDataSource(asPublicClient(makeClient()), {});
    const err = await ds.getNFTCount(WALLET).catch((e) => e);
    expect(err).toBeInstanceOf(DataSourceError);
    expect((err as DataSourceError).code).toBe("NOT_READY");
  });
});

describe("WagmiLockDataSource.getUserLocks", () => {
  it("returns an empty array for wallets with zero locks", async () => {
    const client = makeClient();
    client.readContract.mockResolvedValueOnce(0n);

    const ds = new WagmiLockDataSource(asPublicClient(client), {
      votingEscrow: VE,
    });
    expect(await ds.getUserLocks(WALLET)).toEqual([]);
    expect(client.multicall).not.toHaveBeenCalled();
  });

  it("merges tokenIds and per-lock data into RawLock entries", async () => {
    const client = makeClient();
    client.readContract.mockResolvedValueOnce(2n);
    client.multicall
      .mockResolvedValueOnce([
        { status: "success", result: 10n },
        { status: "success", result: 20n },
      ])
      .mockResolvedValueOnce([
        // Lock #10: locked + balanceOfNFT
        { status: "success", result: [100n, 1_700_000_000n, false] },
        { status: "success", result: 50n },
        // Lock #20: locked + balanceOfNFT (permanent)
        { status: "success", result: [200n, 0n, true] },
        { status: "success", result: 200n },
      ]);

    const ds = new WagmiLockDataSource(asPublicClient(client), {
      votingEscrow: VE,
    });
    const locks = await ds.getUserLocks(WALLET);

    expect(locks).toEqual([
      {
        tokenId: 10n,
        amount: 100n,
        endTimestamp: 1_700_000_000n,
        isPermanent: false,
        votingPower: 50n,
      },
      {
        tokenId: 20n,
        amount: 200n,
        endTimestamp: 0n,
        isPermanent: true,
        votingPower: 200n,
      },
    ]);
  });

  it("handles negative amounts (int128 encoding)", async () => {
    const client = makeClient();
    client.readContract.mockResolvedValueOnce(1n);
    client.multicall
      .mockResolvedValueOnce([{ status: "success", result: 5n }])
      .mockResolvedValueOnce([
        { status: "success", result: [-42n, 0n, false] },
        { status: "success", result: 0n },
      ]);

    const ds = new WagmiLockDataSource(asPublicClient(client), {
      votingEscrow: VE,
    });
    const [lock] = await ds.getUserLocks(WALLET);
    expect(lock.amount).toBe(42n);
  });
});

describe("WagmiLockDataSource.getLockData", () => {
  it("returns RawLock for an existing lock", async () => {
    const client = makeClient();
    client.multicall.mockResolvedValueOnce([
      { status: "success", result: [100n, 1_700_000_000n, false] },
      { status: "success", result: 50n },
    ]);

    const ds = new WagmiLockDataSource(asPublicClient(client), {
      votingEscrow: VE,
    });
    const data = await ds.getLockData(10n);

    expect(data).toEqual({
      tokenId: 10n,
      amount: 100n,
      endTimestamp: 1_700_000_000n,
      isPermanent: false,
      votingPower: 50n,
    });
  });

  it("returns null when the locked() call fails", async () => {
    const client = makeClient();
    client.multicall.mockResolvedValueOnce([
      { status: "failure" },
      { status: "failure" },
    ]);

    const ds = new WagmiLockDataSource(asPublicClient(client), {
      votingEscrow: VE,
    });
    expect(await ds.getLockData(10n)).toBeNull();
  });
});
