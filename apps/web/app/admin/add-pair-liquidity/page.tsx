"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { getAddress, isAddress, parseUnits, formatUnits } from "viem";
import { GiwaUniversalRouterAbi, ERC20Abi, Permit2Abi } from "@giwater/shared/abis";
import { PAIR_DISPLAY_CONFIG_DEFAULT } from "@giwater/shared";
import { useUniversalRouterAddress } from "@/hooks/useContractAddresses";
import { useTokenApprove } from "@/hooks/useTokenApprove";
import { useSettingsStore, getDeadlineTimestamp } from "@/lib/store";
import { GIWASCAN_URL } from "@/lib/config";
import toast from "react-hot-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/Card";
import { Input } from "@/components/admin/ui/Input";
import { Button } from "@/components/admin/ui";
import {
  ADD_PAIR_LIQUIDITY_ZERO,
  baseWeiFromReserves,
  baseWeiInitialFromQuote,
  readBasicPoolReserves,
  readClPoolExists,
  readRouterPermit2AndClFactory,
  readSortedPair,
  sqrtPriceX96FromRatio,
  token1PerToken0Ratio,
} from "@/lib/admin-add-pair-liquidity";

const MAX_UINT256 =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n;
const MAX_UINT160 =
  1461501637330902918203684832716283019655932542975n;
const PERMIT2_EXPIRATION = 4817314800;

type PoolKind = "volatile" | "stable" | "cl";

// ============================================================================
// Display orientation helper
// isFlipped = true means display_base=token1, display_quote=token0
// (e.g. stable is token0 by address sort → Rule 1 makes it quote → flipped)
// ============================================================================

function getDisplayOrientation(
  token0: `0x${string}`,
  token1: `0x${string}`,
  sym0: string,
  sym1: string,
  dec0: number,
  dec1: number,
) {
  const stables = new Set(
    PAIR_DISPLAY_CONFIG_DEFAULT.stableQuoteAddresses.map((s) => s.toLowerCase()),
  );
  const wgiwa = PAIR_DISPLAY_CONFIG_DEFAULT.wrappedNativeAddress.toLowerCase();
  const addr0 = token0.toLowerCase();
  const addr1 = token1.toLowerCase();

  let isFlipped: boolean;
  if ((stables.has(addr0) || stables.has(addr1)) && !(stables.has(addr0) && stables.has(addr1))) {
    isFlipped = stables.has(addr0);
  } else if (
    PAIR_DISPLAY_CONFIG_DEFAULT.wrappedNativeIsQuoteWhenNoStable &&
    (addr0 === wgiwa || addr1 === wgiwa)
  ) {
    isFlipped = addr0 === wgiwa;
  } else {
    isFlipped = false;
  }

  return {
    isFlipped,
    displayBaseSym: isFlipped ? sym1 : sym0,
    displayQuoteSym: isFlipped ? sym0 : sym1,
    displayBaseDec: isFlipped ? dec1 : dec0,
    displayQuoteDec: isFlipped ? dec0 : dec1,
  };
}

export default function AdminAddPairLiquidityPage() {
  const defaultRouter = useUniversalRouterAddress();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { approve } = useTokenApprove();
  const { deadlineMinutes } = useSettingsStore();

  const [routerInput, setRouterInput] = useState("");
  useEffect(() => {
    setRouterInput((prev) => (prev.trim() === "" ? defaultRouter : prev));
  }, [defaultRouter]);

  const [poolKind, setPoolKind] = useState<PoolKind>("volatile");
  const [tokenA, setTokenA] = useState("");
  const [tokenB, setTokenB] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [quoteAmountStr, setQuoteAmountStr] = useState("");
  const [tickSpacing, setTickSpacing] = useState("60");
  const [tickLower, setTickLower] = useState("-6000");
  const [tickUpper, setTickUpper] = useState("6000");

  const [previewLoading, setPreviewLoading] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null);

  const [preview, setPreview] = useState<{
    router: `0x${string}`;
    permit2: `0x${string}`;
    clFactory: `0x${string}`;
    token0: `0x${string}`;
    token1: `0x${string}`;
    dec0: number;
    dec1: number;
    sym0: string;
    sym1: string;
    /** Amount of the display-quote token supplied by the user (token0 wei if isFlipped, else token1 wei). */
    quoteWei: bigint;
    ratio: { num: bigint; den: bigint };
    sqrtPriceX96: bigint;
    impliedHuman: string;
    poolKind: PoolKind;
    stable: boolean;
    isFlipped: boolean;
    displayBaseSym: string;
    displayQuoteSym: string;
    /** Basic only */
    pool?: `0x${string}`;
    poolExists?: boolean;
    reserve0?: bigint;
    reserve1?: bigint;
    /** Derived display-base amount (token1 wei if isFlipped, else token0 wei). */
    baseWei?: bigint;
    /** CL only */
    clPoolExists?: boolean;
    clPool?: `0x${string}`;
    amount0Desired?: bigint;
    amount1Desired?: bigint;
  } | null>(null);

  const routerResolved = useMemo((): `0x${string}` | null => {
    const t = routerInput.trim();
    if (!t || !isAddress(t)) return null;
    try {
      return getAddress(t);
    } catch {
      return null;
    }
  }, [routerInput]);

  const sortHint = useMemo(() => {
    const a = tokenA.trim();
    const b = tokenB.trim();
    if (!isAddress(a) || !isAddress(b)) return null;
    const addrA = getAddress(a).toLowerCase() as `0x${string}`;
    const addrB = getAddress(b).toLowerCase() as `0x${string}`;
    if (addrA === addrB) return null;
    const aIsToken0 = addrA < addrB;
    const token0Addr = aIsToken0 ? getAddress(a) : getAddress(b);
    const token1Addr = aIsToken0 ? getAddress(b) : getAddress(a);
    const token0Label = aIsToken0 ? "Token A" : "Token B";
    const token1Label = aIsToken0 ? "Token B" : "Token A";

    const stables = new Set(
      PAIR_DISPLAY_CONFIG_DEFAULT.stableQuoteAddresses.map((s) => s.toLowerCase()),
    );
    const wgiwa = PAIR_DISPLAY_CONFIG_DEFAULT.wrappedNativeAddress.toLowerCase();
    const aIsStable = stables.has(addrA);
    const bIsStable = stables.has(addrB);
    const aIsWgiwa = addrA === wgiwa;
    const bIsWgiwa = addrB === wgiwa;

    let baseLabel: string;
    let quoteLabel: string;
    let baseAddr: string;
    let quoteAddr: string;
    let orientationRule: string;

    if ((aIsStable || bIsStable) && !(aIsStable && bIsStable)) {
      if (aIsStable) {
        quoteLabel = "Token A (stable)"; quoteAddr = getAddress(a);
        baseLabel = "Token B"; baseAddr = getAddress(b);
      } else {
        quoteLabel = "Token B (stable)"; quoteAddr = getAddress(b);
        baseLabel = "Token A"; baseAddr = getAddress(a);
      }
      orientationRule = "Rule 1 — stable is quote";
    } else if (aIsStable && bIsStable) {
      baseLabel = token0Label + " (token0)"; baseAddr = token0Addr;
      quoteLabel = token1Label + " (token1)"; quoteAddr = token1Addr;
      orientationRule = "Rule 1 exception — both stable, using on-chain order";
    } else if (
      PAIR_DISPLAY_CONFIG_DEFAULT.wrappedNativeIsQuoteWhenNoStable &&
      (aIsWgiwa || bIsWgiwa)
    ) {
      if (aIsWgiwa) {
        quoteLabel = "Token A (WGIWA)"; quoteAddr = getAddress(a);
        baseLabel = "Token B"; baseAddr = getAddress(b);
      } else {
        quoteLabel = "Token B (WGIWA)"; quoteAddr = getAddress(b);
        baseLabel = "Token A"; baseAddr = getAddress(a);
      }
      orientationRule = "Rule 2 — WGIWA is quote";
    } else {
      baseLabel = token0Label + " (token0)"; baseAddr = token0Addr;
      quoteLabel = token1Label + " (token1)"; quoteAddr = token1Addr;
      orientationRule = "Rule 3 — on-chain order";
    }

    return { token0Label, token1Label, token0Addr, token1Addr, baseLabel, quoteLabel, baseAddr, quoteAddr, orientationRule };
  }, [tokenA, tokenB]);

  const approveTokenRouter = useCallback(
    async (
      router: `0x${string}`,
      permit2: `0x${string}`,
      token: `0x${string}`,
    ) => {
      const allowance = (await publicClient!.readContract({
        address: token,
        abi: ERC20Abi,
        functionName: "allowance",
        args: [address!, permit2],
      })) as bigint;
      if (allowance < MAX_UINT256 / 2n) {
        await approve(token, permit2, MAX_UINT256);
      }
      const h1 = await writeContractAsync({
        address: permit2,
        abi: Permit2Abi,
        functionName: "approve",
        args: [token, router, MAX_UINT160, PERMIT2_EXPIRATION],
      });
      if (publicClient && h1) {
        await publicClient.waitForTransactionReceipt({
          hash: h1,
          confirmations: 1,
        });
      }
    },
    [address, approve, publicClient, writeContractAsync],
  );

  const handlePreview = useCallback(async () => {
    setPreview(null);
    setLastTxHash(null);
    if (!publicClient || !routerResolved) {
      toast.error("Set a valid GiwaUniversalRouter address.");
      return;
    }
    let a: `0x${string}`;
    let b: `0x${string}`;
    try {
      a = getAddress(tokenA.trim());
      b = getAddress(tokenB.trim());
    } catch {
      toast.error("Invalid token A or B address.");
      return;
    }
    if (a === b) {
      toast.error("Token A and B must differ.");
      return;
    }
    const pTrim = priceStr.trim();
    const qTrim = quoteAmountStr.trim();
    if (!pTrim || !qTrim) {
      toast.error("Price and quote amount are required.");
      return;
    }

    setPreviewLoading(true);
    try {
      const { permit2, clFactory } = await readRouterPermit2AndClFactory(
        publicClient,
        routerResolved,
      );
      const sorted = await readSortedPair(publicClient, routerResolved, a, b);
      const { isFlipped, displayBaseSym, displayQuoteSym } = getDisplayOrientation(
        sorted.token0, sorted.token1,
        sorted.sym0, sorted.sym1,
        sorted.dec0, sorted.dec1,
      );

      // Compute price ratio in token1/token0 (on-chain) terms.
      // User always enters: display_quote per 1 display_base.
      // Non-flipped (base=token0, quote=token1): ratio = token1PerToken0Ratio directly.
      // Flipped (base=token1, quote=token0):
      //   p = token0_human/token1_human → token1/token0 = (1/p) * 10^dec1/10^dec0
      //   num = 10^dec1 * 10^18,  den = priceFixed * 10^dec0
      let ratio: { num: bigint; den: bigint } | null;
      if (!isFlipped) {
        ratio = token1PerToken0Ratio(pTrim, sorted.dec0, sorted.dec1);
        if (!ratio) {
          toast.error("Invalid price (positive decimal, max 18 fractional places).");
          return;
        }
      } else {
        let priceFixed: bigint;
        try {
          priceFixed = parseUnits(pTrim, 18);
        } catch {
          priceFixed = 0n;
        }
        if (priceFixed <= 0n) {
          toast.error("Invalid price (positive decimal, max 18 fractional places).");
          return;
        }
        ratio = {
          num: (10n ** BigInt(sorted.dec1)) * (10n ** 18n),
          den: priceFixed * (10n ** BigInt(sorted.dec0)),
        };
      }

      const sqrtPriceX96 = sqrtPriceX96FromRatio(ratio.num, ratio.den);

      // quoteWei: user-specified display-quote token amount, in its own decimals.
      // Non-flipped: display_quote = token1 → use dec1.
      // Flipped:    display_quote = token0 → use dec0.
      let quoteWei: bigint;
      try {
        quoteWei = parseUnits(qTrim, isFlipped ? sorted.dec0 : sorted.dec1);
      } catch {
        toast.error(`Invalid amount for ${isFlipped ? sorted.sym0 : sorted.sym1} decimals.`);
        return;
      }

      const stable = poolKind === "stable";
      const kind = poolKind;

      if (kind === "volatile" || kind === "stable") {
        const { pool, poolExists, reserve0, reserve1 } =
          await readBasicPoolReserves(
            publicClient,
            routerResolved,
            sorted.token0,
            sorted.token1,
            stable,
          );
        const treatAsInitial =
          !poolExists || (reserve0 === 0n && reserve1 === 0n);

        // baseWei = derived display-base token amount.
        // Non-flipped: baseWei = token0 amount.
        // Flipped:     baseWei = token1 amount.
        let baseWei: bigint;
        if (!isFlipped) {
          baseWei = treatAsInitial
            ? baseWeiInitialFromQuote(quoteWei, ratio.num, ratio.den)
            : baseWeiFromReserves(quoteWei, reserve0, reserve1);
        } else {
          // Flipped: quoteWei is token0. Need token1.
          // Initial: token1 = quoteWei * ratio.num / ratio.den
          // Reserves: token1 = quoteWei * reserve1 / reserve0
          baseWei = treatAsInitial
            ? (quoteWei * ratio.num) / ratio.den
            : baseWeiFromReserves(quoteWei, reserve1, reserve0);
        }

        setPreview({
          router: routerResolved,
          permit2,
          clFactory,
          ...sorted,
          quoteWei,
          ratio,
          sqrtPriceX96,
          impliedHuman: pTrim,
          poolKind: kind,
          stable,
          isFlipped,
          displayBaseSym,
          displayQuoteSym,
          pool,
          poolExists,
          reserve0,
          reserve1,
          baseWei,
        });
        toast.success("Preview ready (basic pool).");
        return;
      }

      // CL
      const ts = Number.parseInt(tickSpacing.trim(), 10);
      const tl = Number.parseInt(tickLower.trim(), 10);
      const tu = Number.parseInt(tickUpper.trim(), 10);
      if (!Number.isFinite(ts) || !Number.isFinite(tl) || !Number.isFinite(tu)) {
        toast.error("Invalid tick spacing or tick bounds.");
        return;
      }
      const { pool: clPool, exists: clPoolExists } = await readClPoolExists(
        publicClient,
        clFactory,
        sorted.token0,
        sorted.token1,
        ts,
      );

      if (!address) {
        toast.error("Connect a wallet to preview CL (uses your token balances).");
        return;
      }
      const [b0, b1] = (await Promise.all([
        publicClient.readContract({
          address: sorted.token0,
          abi: ERC20Abi,
          functionName: "balanceOf",
          args: [address],
        }),
        publicClient.readContract({
          address: sorted.token1,
          abi: ERC20Abi,
          functionName: "balanceOf",
          args: [address],
        }),
      ])) as readonly [bigint, bigint];

      // Non-flipped: user caps token1 (quote) deposit; token0 uses full balance.
      // Flipped:     user caps token0 (quote) deposit; token1 uses full balance.
      const amount0Desired = !isFlipped ? b0 : (quoteWei < b0 ? quoteWei : b0);
      const amount1Desired = !isFlipped ? (quoteWei < b1 ? quoteWei : b1) : b1;

      setPreview({
        router: routerResolved,
        permit2,
        clFactory,
        ...sorted,
        quoteWei,
        ratio,
        sqrtPriceX96,
        impliedHuman: pTrim,
        poolKind: "cl",
        stable: false,
        isFlipped,
        displayBaseSym,
        displayQuoteSym,
        clPoolExists,
        clPool,
        amount0Desired,
        amount1Desired,
      });
      toast.success("Preview ready (CL pool).");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message.slice(0, 200) : "Preview failed.");
    } finally {
      setPreviewLoading(false);
    }
  }, [
    address,
    poolKind,
    priceStr,
    publicClient,
    quoteAmountStr,
    routerResolved,
    tickLower,
    tickSpacing,
    tickUpper,
    tokenA,
    tokenB,
  ]);

  const handleExecute = useCallback(async () => {
    if (!preview || !publicClient || !address) {
      toast.error("Run preview first and connect a wallet.");
      return;
    }
    setExecuteLoading(true);
    setLastTxHash(null);
    try {
      const deadline = getDeadlineTimestamp(deadlineMinutes);

      if (preview.poolKind === "volatile" || preview.poolKind === "stable") {
        const ratio = preview.ratio;
        const { poolExists, reserve0, reserve1 } =
          await readBasicPoolReserves(
            publicClient,
            preview.router,
            preview.token0,
            preview.token1,
            preview.stable,
          );
        const treatAsInitial =
          !poolExists || (reserve0 === 0n && reserve1 === 0n);

        // Re-derive display-base amount from fresh reserves (same logic as handlePreview).
        let baseWei: bigint;
        if (!preview.isFlipped) {
          baseWei = treatAsInitial
            ? baseWeiInitialFromQuote(preview.quoteWei, ratio.num, ratio.den)
            : baseWeiFromReserves(preview.quoteWei, reserve0, reserve1);
        } else {
          baseWei = treatAsInitial
            ? (preview.quoteWei * ratio.num) / ratio.den
            : baseWeiFromReserves(preview.quoteWei, reserve1, reserve0);
        }

        // Map display base/quote back to on-chain token0/token1 amounts.
        const amount0 = !preview.isFlipped ? baseWei : preview.quoteWei;
        const amount1 = !preview.isFlipped ? preview.quoteWei : baseWei;

        const [balToken0, balToken1] = (await Promise.all([
          publicClient.readContract({
            address: preview.token0,
            abi: ERC20Abi,
            functionName: "balanceOf",
            args: [address],
          }),
          publicClient.readContract({
            address: preview.token1,
            abi: ERC20Abi,
            functionName: "balanceOf",
            args: [address],
          }),
        ])) as readonly [bigint, bigint];

        if (amount0 <= 0n || amount1 <= 0n) {
          toast.error("Computed deposit amount is zero.");
          return;
        }
        if (balToken0 < amount0) {
          toast.error(
            `Insufficient ${preview.sym0}: need ${formatUnits(amount0, preview.dec0)}, have ${formatUnits(balToken0, preview.dec0)}.`,
          );
          return;
        }
        if (balToken1 < amount1) {
          toast.error(
            `Insufficient ${preview.sym1}: need ${formatUnits(amount1, preview.dec1)}, have ${formatUnits(balToken1, preview.dec1)}.`,
          );
          return;
        }

        await approveTokenRouter(preview.router, preview.permit2, preview.token0);
        await approveTokenRouter(preview.router, preview.permit2, preview.token1);

        const hash = await writeContractAsync({
          address: preview.router,
          abi: GiwaUniversalRouterAbi,
          functionName: "addLiquidity",
          args: [
            preview.token0,
            preview.token1,
            preview.stable,
            amount0,
            amount1,
            0n,
            0n,
            address,
            deadline,
          ],
        });
        setLastTxHash(hash);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        }
        toast.success("addLiquidity confirmed.");
        return;
      }

      // CL
      const ts = Number.parseInt(tickSpacing.trim(), 10);
      const tl = Number.parseInt(tickLower.trim(), 10);
      const tu = Number.parseInt(tickUpper.trim(), 10);
      const [b0, b1] = (await Promise.all([
        publicClient.readContract({
          address: preview.token0,
          abi: ERC20Abi,
          functionName: "balanceOf",
          args: [address],
        }),
        publicClient.readContract({
          address: preview.token1,
          abi: ERC20Abi,
          functionName: "balanceOf",
          args: [address],
        }),
      ])) as readonly [bigint, bigint];

      const a0 = !preview.isFlipped ? b0 : (preview.quoteWei < b0 ? preview.quoteWei : b0);
      const a1 = !preview.isFlipped ? (preview.quoteWei < b1 ? preview.quoteWei : b1) : b1;
      if (a0 === 0n && a1 === 0n) {
        toast.error("CL desired amounts are zero.");
        return;
      }

      await approveTokenRouter(preview.router, preview.permit2, preview.token0);
      await approveTokenRouter(preview.router, preview.permit2, preview.token1);

      const hash = await writeContractAsync({
        address: preview.router,
        abi: GiwaUniversalRouterAbi,
        functionName: "clAddLiquidity",
        args: [
          {
            token0: preview.token0,
            token1: preview.token1,
            tickSpacing: ts,
            tickLower: tl,
            tickUpper: tu,
            amount0Desired: a0,
            amount1Desired: a1,
            amount0Min: 0n,
            amount1Min: 0n,
            recipient: address,
            deadline,
            sqrtPriceX96: preview.sqrtPriceX96,
          },
        ],
      });
      setLastTxHash(hash);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      }
      toast.success("clAddLiquidity confirmed.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message.slice(0, 200) : "Transaction failed.");
    } finally {
      setExecuteLoading(false);
    }
  }, [
    address,
    approveTokenRouter,
    deadlineMinutes,
    preview,
    publicClient,
    tickLower,
    tickSpacing,
    tickUpper,
    writeContractAsync,
  ]);

  // Dynamic price/quote labels (show symbols once preview is available or sortHint exists).
  const priceLabel = preview
    ? `Price — ${preview.displayQuoteSym} per 1 ${preview.displayBaseSym} (display quote/base)`
    : sortHint
      ? `Price — display quote per 1 display base (${sortHint.orientationRule})`
      : "Price (display quote per 1 display base)";

  const quoteLabel = preview
    ? `${preview.displayQuoteSym} amount to deposit`
    : sortHint
      ? `Display quote amount to deposit (${sortHint.quoteLabel})`
      : "Display quote amount to deposit";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-ds-gray-1000">
          Add pair liquidity (QA)
        </h1>
        <p className="text-sm text-ds-gray-700 mt-1">
          GiwaUniversalRouter + Permit2, basic volatile/stable or CL. Enter price as{" "}
          <strong>display quote per 1 display base</strong> (orientation auto-detected from
          stable/WGIWA rules). The derived on-chain token0/token1 amounts are computed
          internally and adjusted with the correct decimals.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
              GiwaUniversalRouter (override optional)
            </label>
            <Input
              value={routerInput}
              onChange={(e) => setRouterInput(e.target.value)}
              placeholder={defaultRouter}
              className="font-geist-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
              Pool type
            </span>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="poolKind"
                  checked={poolKind === "volatile"}
                  onChange={() => setPoolKind("volatile")}
                />
                Basic volatile
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="poolKind"
                  checked={poolKind === "stable"}
                  onChange={() => setPoolKind("stable")}
                />
                Basic stable
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="poolKind"
                  checked={poolKind === "cl"}
                  onChange={() => setPoolKind("cl")}
                />
                CL
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                Token A
              </label>
              <Input
                value={tokenA}
                onChange={(e) => setTokenA(e.target.value)}
                className="font-geist-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                Token B
              </label>
              <Input
                value={tokenB}
                onChange={(e) => setTokenB(e.target.value)}
                className="font-geist-mono text-sm"
              />
            </div>
          </div>

          {sortHint && (
            <div className="rounded-md border border-ds-gray-400 bg-ds-background-200 px-3 py-2 text-xs font-geist-mono space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-ds-gray-600 font-sans font-medium">On-chain sort</p>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-ds-gray-600 w-20 shrink-0">token0:</span>
                  <span className="text-ds-gray-900 font-semibold">{sortHint.token0Label}</span>
                  <span className="text-ds-gray-700 break-all">{sortHint.token0Addr}</span>
                </div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-ds-gray-600 w-20 shrink-0">token1:</span>
                  <span className="text-ds-gray-900 font-semibold">{sortHint.token1Label}</span>
                  <span className="text-ds-gray-700 break-all">{sortHint.token1Addr}</span>
                </div>
              </div>
              <div className="border-t border-ds-gray-400 pt-2 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-ds-gray-600 font-sans font-medium">
                  Display base/quote — <span className="normal-case">{sortHint.orientationRule}</span>
                </p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-ds-gray-600 w-20 shrink-0">base:</span>
                  <span className="text-ds-green-600 dark:text-ds-green-400 font-semibold">{sortHint.baseLabel}</span>
                  <span className="text-ds-gray-700 break-all">{sortHint.baseAddr}</span>
                </div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-ds-gray-600 w-20 shrink-0">quote:</span>
                  <span className="text-ds-blue-600 dark:text-ds-blue-400 font-semibold">{sortHint.quoteLabel}</span>
                  <span className="text-ds-gray-700 break-all">{sortHint.quoteAddr}</span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                {priceLabel}
              </label>
              <Input
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="e.g. 3500.25"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                {quoteLabel}
              </label>
              <Input
                value={quoteAmountStr}
                onChange={(e) => setQuoteAmountStr(e.target.value)}
                placeholder="decimal"
              />
            </div>
          </div>

          {poolKind === "cl" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                  Tick spacing
                </label>
                <Input
                  value={tickSpacing}
                  onChange={(e) => setTickSpacing(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                  Tick lower
                </label>
                <Input
                  value={tickLower}
                  onChange={(e) => setTickLower(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                  Tick upper
                </label>
                <Input
                  value={tickUpper}
                  onChange={(e) => setTickUpper(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handlePreview()}
              disabled={!publicClient || previewLoading}
            >
              {previewLoading ? "Loading…" : "Preview"}
            </Button>
            <Button
              type="button"
              onClick={() => void handleExecute()}
              disabled={
                !preview ||
                !isConnected ||
                !address ||
                executeLoading ||
                previewLoading
              }
            >
              {executeLoading ? "Sending…" : "Approve + add liquidity"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm font-geist-mono text-ds-gray-1000">
            <p>
              display base/quote: <strong>{preview.displayBaseSym}</strong> / <strong>{preview.displayQuoteSym}</strong>
              {preview.isFlipped && <span className="text-ds-yellow-600 ml-2">(orientation flipped from on-chain order)</span>}
            </p>
            <p>
              on-chain token0/token1: {preview.sym0}/{preview.sym1}
            </p>
            <p className="break-all">token0: {preview.token0}</p>
            <p className="break-all">token1: {preview.token1}</p>
            <p>
              Price entered: {preview.impliedHuman} {preview.displayQuoteSym} per 1 {preview.displayBaseSym}
            </p>
            <p>
              token1/token0 ratio (contract): {preview.ratio.num.toString()}/{preview.ratio.den.toString()}
            </p>
            <p>sqrtPriceX96 (if new CL / reference): {preview.sqrtPriceX96.toString()}</p>
            <p className="break-all">Permit2: {preview.permit2}</p>
            {preview.poolKind !== "cl" ? (
              <>
                <p>Type: {preview.stable ? "Basic stable" : "Basic volatile"}</p>
                <p className="break-all">Pool: {preview.pool ?? ADD_PAIR_LIQUIDITY_ZERO}</p>
                <p>
                  Pool exists: {preview.poolExists ? "yes" : "no"} — zero reserves:{" "}
                  {preview.poolExists &&
                  preview.reserve0 === 0n &&
                  preview.reserve1 === 0n
                    ? "yes (initial ratio from price)"
                    : preview.poolExists
                      ? "no"
                      : "n/a"}
                </p>
                {preview.poolExists &&
                  !(preview.reserve0 === 0n && preview.reserve1 === 0n) && (
                  <p>
                    Reserves r0/r1: {preview.reserve0?.toString()} /{" "}
                    {preview.reserve1?.toString()}
                  </p>
                )}
                <p>
                  Will supply ~
                  {!preview.isFlipped
                    ? `${formatUnits(preview.baseWei ?? 0n, preview.dec0)} ${preview.sym0} + ${formatUnits(preview.quoteWei, preview.dec1)} ${preview.sym1}`
                    : `${formatUnits(preview.quoteWei, preview.dec0)} ${preview.sym0} + ${formatUnits(preview.baseWei ?? 0n, preview.dec1)} ${preview.sym1}`}
                </p>
              </>
            ) : (
              <>
                <p>Type: CL</p>
                <p className="break-all">
                  CL pool: {preview.clPool} ({preview.clPoolExists ? "exists" : "none yet"})
                </p>
                <p>
                  Desired caps:{" "}
                  {formatUnits(preview.amount0Desired ?? 0n, preview.dec0)} {preview.sym0}{" "}
                  (token0),{" "}
                  {formatUnits(preview.amount1Desired ?? 0n, preview.dec1)} {preview.sym1}{" "}
                  (token1)
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {lastTxHash && (
        <p className="text-sm">
          <a
            href={`${GIWASCAN_URL}/tx/${lastTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ds-blue-400 underline font-geist-mono break-all"
          >
            {lastTxHash}
          </a>
        </p>
      )}
    </div>
  );
}
