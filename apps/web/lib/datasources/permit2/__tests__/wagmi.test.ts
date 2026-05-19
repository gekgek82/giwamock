import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import { WagmiPermit2DataSource } from "@/lib/datasources/permit2/wagmi";

const PERMIT2 = "0x0000000000000000000000000000000000000aaa" as const;
const TOKEN = "0x1111111111111111111111111111111111111111" as const;
const OWNER = "0x2222222222222222222222222222222222222222" as const;
const SPENDER = "0x3333333333333333333333333333333333333333" as const;

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

describe("WagmiPermit2DataSource.getAllowance", () => {
  it("decomposes the [amount, expiration, nonce] tuple", async () => {
    const client = makeClient();
    client.readContract.mockResolvedValueOnce([
      500n,
      1_800_000_000,
      7,
    ]);

    const ds = new WagmiPermit2DataSource(asPublicClient(client));
    const sub = await ds.getAllowance(PERMIT2, TOKEN, OWNER, SPENDER);

    expect(sub).toEqual({
      amount: 500n,
      expiration: 1_800_000_000,
      nonce: 7,
    });
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: PERMIT2,
        functionName: "allowance",
        // Permit2.allowance takes (owner, token, spender) — note the order
        args: [OWNER, TOKEN, SPENDER],
      }),
    );
  });
});
