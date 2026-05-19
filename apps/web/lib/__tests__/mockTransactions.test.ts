import { describe, expect, it } from "vitest";

import {
  createMockSignature,
  createMockTxHash,
  simulateMockTransaction,
} from "@/lib/mockTransactions";

describe("mockTransactions", () => {
  it("creates deterministic transaction-like hashes for the same label and nonce", () => {
    const first = createMockTxHash("swap", 1);
    const second = createMockTxHash("swap", 1);

    expect(first).toBe(second);
    expect(first).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("creates different hashes for different nonces", () => {
    expect(createMockTxHash("swap", 1)).not.toBe(createMockTxHash("swap", 2));
  });

  it("simulates a successful transaction without using a wallet provider", async () => {
    const hash = await simulateMockTransaction({ label: "approve", delayMs: 0 });

    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("can simulate a rejected transaction", async () => {
    await expect(
      simulateMockTransaction({
        label: "swap",
        delayMs: 0,
        outcome: "rejected",
      }),
    ).rejects.toThrow("User rejected mock transaction");
  });

  it("creates deterministic signature-like values", () => {
    const signature = createMockSignature({
      address: "0x0000000000000000000000000000000000000abc",
      message: "Lock 10 tPOINT",
    });

    expect(signature).toMatch(/^0x[a-f0-9]{130}$/);
    expect(signature).toBe(
      createMockSignature({
        address: "0x0000000000000000000000000000000000000abc",
        message: "Lock 10 tPOINT",
      }),
    );
  });
});
