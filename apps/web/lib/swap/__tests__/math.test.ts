import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";

import {
  classifyPath,
  computeBasicQuote,
  computeCLMaxOutput,
  computeCLQuote,
  computePriceImpact,
  Q96,
  SPOT_REF_AMOUNT,
} from "@/lib/swap/math";

describe("classifyPath", () => {
  it("returns BASIC when every hop is non-CL", () => {
    expect(
      classifyPath([{ poolType: "BASIC" }, { poolType: "BASIC" }]),
    ).toBe("BASIC");
  });

  it("returns CL when every hop is CL", () => {
    expect(classifyPath([{ poolType: "CL" }, { poolType: "CL" }])).toBe(
      "CL",
    );
  });

  it("returns MIXED when CL and BASIC are combined", () => {
    expect(classifyPath([{ poolType: "CL" }, { poolType: "BASIC" }])).toBe(
      "MIXED",
    );
  });

  it("treats missing poolType as BASIC", () => {
    expect(classifyPath([{}, {}])).toBe("BASIC");
  });
});

describe("computeBasicQuote", () => {
  it("returns zero when any reserve or amount is zero", () => {
    expect(computeBasicQuote(0n, 1n, 30, 1n)).toBe(0n);
    expect(computeBasicQuote(1n, 0n, 30, 1n)).toBe(0n);
    expect(computeBasicQuote(1n, 1n, 30, 0n)).toBe(0n);
  });

  it("applies a 0.30% fee to the input amount (Velo volatile default)", () => {
    const reserveIn = parseUnits("1000", 18);
    const reserveOut = parseUnits("1000", 18);
    const amountIn = parseUnits("1", 18);

    const out = computeBasicQuote(reserveIn, reserveOut, 30, amountIn);
    // 0.997 * 1000 / (1000 + 0.997) ≈ 0.99602
    expect(out).toBeGreaterThan(parseUnits("0.99", 18));
    expect(out).toBeLessThan(parseUnits("1", 18));
  });

  it("returns more output for a stable (5bps) pool than volatile (30bps)", () => {
    const reserveIn = parseUnits("1000", 18);
    const reserveOut = parseUnits("1000", 18);
    const amountIn = parseUnits("10", 18);

    const stable = computeBasicQuote(reserveIn, reserveOut, 5, amountIn);
    const volatile = computeBasicQuote(reserveIn, reserveOut, 30, amountIn);
    expect(stable).toBeGreaterThan(volatile);
  });
});

describe("computeCLMaxOutput", () => {
  it("returns zero when sqrtPrice or liquidity is zero", () => {
    expect(computeCLMaxOutput(0n, 100n, true)).toBe(0n);
    expect(computeCLMaxOutput(Q96, 0n, true)).toBe(0n);
  });

  it("is symmetric with direction when sqrtPriceX96 == Q96 (price 1:1)", () => {
    // At sqrtP = Q96 the price is 1, so max output in either direction
    // equals the liquidity (since L * Q96 / Q96 = L and L * Q96 / Q96 = L).
    const L = 1_000n;
    expect(computeCLMaxOutput(Q96, L, true)).toBe(L);
    expect(computeCLMaxOutput(Q96, L, false)).toBe(L);
  });
});

describe("computeCLQuote", () => {
  it("returns zero for zero amount or zero state", () => {
    expect(computeCLQuote(0n, 1n, 100n, 1n, true)).toBe(0n);
    expect(computeCLQuote(Q96, 0n, 100n, 1n, true)).toBe(0n);
    expect(computeCLQuote(Q96, 1n, 100n, 0n, true)).toBe(0n);
  });

  it("produces a non-zero output for a typical zero-for-one swap", () => {
    // Big liquidity, 1:1 price, small swap → output ≈ amountIn * (1 - fee).
    const L = parseUnits("1000000", 18);
    const fee = 3_000n; // 0.30%
    const amountIn = parseUnits("1", 18);
    const out = computeCLQuote(Q96, L, fee, amountIn, true);
    expect(out).toBeGreaterThan(0n);
    // Fee-adjusted input is 0.997; with huge L the output tracks that closely.
    expect(out).toBeLessThan(parseUnits("0.9971", 18));
  });

  it("returns more output for a lower fee", () => {
    const L = parseUnits("1000000", 18);
    const amountIn = parseUnits("1", 18);
    const loFee = computeCLQuote(Q96, L, 500n, amountIn, true); // 0.05%
    const hiFee = computeCLQuote(Q96, L, 3_000n, amountIn, true); // 0.30%
    expect(loFee).toBeGreaterThan(hiFee);
  });
});

describe("computePriceImpact", () => {
  it("is zero when any input is missing", () => {
    expect(computePriceImpact(0n, 1n, 1n)).toBe(0);
    expect(computePriceImpact(1n, 0n, 1n)).toBe(0);
    expect(computePriceImpact(1n, 1n, 0n)).toBe(0);
  });

  it("is near zero when execution matches spot (small swap)", () => {
    // If output/quoteInput ≈ spotOutput/SPOT_REF_AMOUNT, impact → 0
    const output = 997_000n;
    const quoteInput = 1_000_000n;
    const spotOutput = SPOT_REF_AMOUNT * 997n / 1000n; // 0.997 rate
    const impact = computePriceImpact(output, spotOutput, quoteInput);
    expect(impact).toBeLessThan(0.01);
  });

  it("is positive when execution is worse than spot", () => {
    // Large swap: execution rate much lower than spot rate.
    const spotOutput = SPOT_REF_AMOUNT; // 1:1 spot
    const quoteInput = parseUnits("1000", 18);
    const output = parseUnits("500", 18); // 0.5 rate
    const impact = computePriceImpact(output, spotOutput, quoteInput);
    expect(impact).toBeGreaterThan(40);
  });
});
