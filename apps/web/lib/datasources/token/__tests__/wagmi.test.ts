import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import { WagmiTokenDataSource } from "@/lib/datasources/token/wagmi";

const TOKEN = "0x0000000000000000000000000000000000000aaa" as const;
const WALLET = "0x1111111111111111111111111111111111111111" as const;
const SPENDER = "0x2222222222222222222222222222222222222222" as const;

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

describe("WagmiTokenDataSource.getBalance", () => {
  it("returns balanceOf for wallet", async () => {
    const client = makeClient();
    client.readContract.mockResolvedValueOnce(1_000n);

    const ds = new WagmiTokenDataSource(asPublicClient(client));
    const balance = await ds.getBalance(TOKEN, WALLET);

    expect(balance).toBe(1_000n);
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TOKEN,
        functionName: "balanceOf",
        args: [WALLET],
      }),
    );
  });
});

describe("WagmiTokenDataSource.getAllowance", () => {
  it("returns allowance(owner, spender)", async () => {
    const client = makeClient();
    client.readContract.mockResolvedValueOnce(42n);

    const ds = new WagmiTokenDataSource(asPublicClient(client));
    const allowance = await ds.getAllowance(TOKEN, WALLET, SPENDER);

    expect(allowance).toBe(42n);
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TOKEN,
        functionName: "allowance",
        args: [WALLET, SPENDER],
      }),
    );
  });
});

describe("WagmiTokenDataSource.getMetadata", () => {
  it("returns full metadata when all three calls succeed", async () => {
    const client = makeClient();
    client.multicall.mockResolvedValueOnce([
      { status: "success", result: "WETH" },
      { status: "success", result: "Wrapped Ether" },
      { status: "success", result: 18 },
    ]);

    const ds = new WagmiTokenDataSource(asPublicClient(client));
    const metadata = await ds.getMetadata(TOKEN);

    expect(metadata).toEqual({
      address: TOKEN,
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
    });
  });

  it("returns null when the symbol call fails (not a valid ERC-20)", async () => {
    const client = makeClient();
    client.multicall.mockResolvedValueOnce([
      { status: "failure" },
      { status: "failure" },
      { status: "failure" },
    ]);

    const ds = new WagmiTokenDataSource(asPublicClient(client));
    expect(await ds.getMetadata(TOKEN)).toBeNull();
  });

  it("falls back when only name/decimals fail", async () => {
    const client = makeClient();
    client.multicall.mockResolvedValueOnce([
      { status: "success", result: "DAI" },
      { status: "failure" },
      { status: "failure" },
    ]);

    const ds = new WagmiTokenDataSource(asPublicClient(client));
    const metadata = await ds.getMetadata(TOKEN);

    expect(metadata).toEqual({
      address: TOKEN,
      symbol: "DAI",
      name: "DAI",
      decimals: 18,
    });
  });
});
