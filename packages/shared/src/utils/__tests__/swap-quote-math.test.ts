import { describe, it, expect } from "vitest";
import {
  computeBasicQuote,
  computePriceImpactWithSpotInput,
} from "../swap-quote-math";

function uiToWei(amount: number, decimals: number): bigint {
  const scale = 10n ** BigInt(decimals);
  // Only used with clean test numbers (no recurring decimals).
  return BigInt(Math.round(amount * Number(scale)));
}

/**
 * Reference amount used by broker after the fix:
 * - decimals <= 11: 0.01 token
 * - decimals >= 12: 0.000001 token
 */
function spotRefAmountWei(decimals: number): bigint {
  if (decimals <= 0) return 1n;
  if (decimals <= 11) return 10n ** BigInt(Math.max(0, decimals - 2));
  return 10n ** BigInt(decimals - 6);
}

describe("swap quote math", () => {
  it("price impact is > 0 for a meaningful trade size (USDC->ETH example)", () => {
    // Reserves: 1,000,000 USDC vs 500 ETH  (implied ~2000 USDC/ETH)
    const usdcDec = 6;
    const ethDec = 18;
    const reserveUsdc = uiToWei(1_000_000, usdcDec);
    const reserveEth = uiToWei(500, ethDec);

    // Trade: 1,000 USDC in
    const amountIn = uiToWei(1_000, usdcDec);
    const feeBps = 30;

    const out = computeBasicQuote(reserveUsdc, reserveEth, feeBps, amountIn);
    expect(out).toBeGreaterThan(0n);

    // Spot output uses tiny reference size in tokenIn units
    const spotIn = spotRefAmountWei(usdcDec);
    const spotOut = computeBasicQuote(reserveUsdc, reserveEth, feeBps, spotIn);
    expect(spotOut).toBeGreaterThan(0n);

    const impact = computePriceImpactWithSpotInput(out, spotOut, amountIn, spotIn);
    expect(impact).toBeGreaterThan(0);
    expect(impact).toBeLessThan(5); // should be a small number for deep-ish pool
  });

  it("using a too-large spot reference for 6-dec tokens collapses impact toward 0 (regression guard)", () => {
    const usdcDec = 6;
    const ethDec = 18;
    const reserveUsdc = uiToWei(1_000_000, usdcDec);
    const reserveEth = uiToWei(500, ethDec);
    const amountIn = uiToWei(1_000, usdcDec);
    const feeBps = 30;

    const out = computeBasicQuote(reserveUsdc, reserveEth, feeBps, amountIn);

    // Old constant SPOT_REF_AMOUNT (1e12 base units) interpreted as USDC wei => 1,000,000 USDC
    const oldSpotRef = 1_000_000_000_000n;
    const oldSpotOut = computeBasicQuote(reserveUsdc, reserveEth, feeBps, oldSpotRef);
    const impactOld = computePriceImpactWithSpotInput(out, oldSpotOut, amountIn, oldSpotRef);

    const newSpotRef = spotRefAmountWei(usdcDec);
    const newSpotOut = computeBasicQuote(reserveUsdc, reserveEth, feeBps, newSpotRef);
    const impactNew = computePriceImpactWithSpotInput(out, newSpotOut, amountIn, newSpotRef);

    // New should be strictly larger in this setup.
    expect(impactNew).toBeGreaterThan(impactOld);
  });
});

