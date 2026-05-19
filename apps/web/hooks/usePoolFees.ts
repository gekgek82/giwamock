import { useReadContracts } from "wagmi";
import {
  usePoolFactoryAddress,
  useClPoolFactoryAddress,
} from "@/hooks/useContractAddresses";
import { PoolFactoryAbi, CLPoolAbi, CLFactoryAbi, SwapFeeModuleAbi } from "@giwater/shared/abis";

interface Route {
  from: `0x${string}`;
  to: `0x${string}`;
  stable: boolean;
  factory: `0x${string}`;
  poolType?: string;
}

/**
 * Get fees for multiple routes, with CL dynamic fee support.
 * For CL pools (identified by factory matching clPoolFactory), reads fee directly
 * from the pool contract and checks for dynamic fee module.
 */
export function usePoolFees(
  routes: Route[] | null,
  poolAddresses?: (`0x${string}` | undefined)[]
) {
  const poolFactoryAddress = usePoolFactoryAddress();
  const clPoolFactoryAddress = useClPoolFactoryAddress();

  // Get default fees for basic pools
  const { data: defaultFeesData } = useReadContracts({
    contracts: poolFactoryAddress
      ? [
          {
            address: poolFactoryAddress,
            abi: PoolFactoryAbi,
            functionName: "stableFee",
          },
          {
            address: poolFactoryAddress,
            abi: PoolFactoryAbi,
            functionName: "volatileFee",
          },
        ]
      : [],
    query: {
      enabled: !!poolFactoryAddress,
    },
  });

  const stableFee =
    defaultFeesData?.[0]?.status === "success"
      ? Number(defaultFeesData[0].result)
      : 5;

  const volatileFee =
    defaultFeesData?.[1]?.status === "success"
      ? Number(defaultFeesData[1].result)
      : 30;

  // [DEBUG] Fee source check
  console.log("[usePoolFees] defaultFeesData:", defaultFeesData);
  console.log("[usePoolFees] stableFee:", stableFee, "source:", defaultFeesData?.[0]?.status === "success" ? "CONTRACT" : "FALLBACK");
  console.log("[usePoolFees] volatileFee:", volatileFee, "source:", defaultFeesData?.[1]?.status === "success" ? "CONTRACT" : "FALLBACK");

  // Check if CLFactory has a swapFeeModule
  const { data: swapFeeModuleAddr } = useReadContracts({
    contracts: clPoolFactoryAddress
      ? [
          {
            address: clPoolFactoryAddress,
            abi: CLFactoryAbi,
            functionName: "swapFeeModule",
          },
        ]
      : [],
    query: {
      enabled: !!clPoolFactoryAddress,
    },
  });

  const swapFeeModule =
    swapFeeModuleAddr?.[0]?.status === "success"
      ? (swapFeeModuleAddr[0].result as string)
      : null;
  const hasSwapFeeModule =
    !!swapFeeModule &&
    swapFeeModule !== "0x0000000000000000000000000000000000000000";

  // Build CL pool fee read calls
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clPoolContracts: any[] = [];

  routes?.forEach((route, i) => {
    const isCL = route.poolType === "CL";
    const poolAddr = poolAddresses?.[i];

    if (!isCL || !poolAddr) return;

    clPoolContracts.push({
      address: poolAddr,
      abi: CLPoolAbi,
      functionName: "fee",
    });

    if (hasSwapFeeModule) {
      clPoolContracts.push({
        address: swapFeeModule as `0x${string}`,
        abi: SwapFeeModuleAbi,
        functionName: "getFee",
        args: [poolAddr],
      });
    }
  });

  const { data: clFeeData } = useReadContracts({
    contracts: clPoolContracts,
    query: {
      enabled: clPoolContracts.length > 0,
    },
  });

  // Build fee results per route
  let clDataIdx = 0;
  const fees = routes?.map((route, i) => {
    const isCL = route.poolType === "CL";
    const poolAddr = poolAddresses?.[i];

    if (isCL && poolAddr) {
      // Read base fee from CL pool
      const baseFeeResult = clFeeData?.[clDataIdx];
      clDataIdx++;

      const baseFeeRaw =
        baseFeeResult?.status === "success"
          ? Math.round(Number(baseFeeResult.result) / 100)
          : 30;

      let currentFeeBps = baseFeeRaw;

      if (hasSwapFeeModule) {
        const dynamicFeeResult = clFeeData?.[clDataIdx];
        clDataIdx++;
        if (dynamicFeeResult?.status === "success") {
          currentFeeBps = Math.round(Number(dynamicFeeResult.result) / 100);
        }
      }

      return {
        route,
        feeBasisPoints: currentFeeBps,
        feePercent: currentFeeBps / 10000,
        feeDisplay: `${(currentFeeBps / 100).toFixed(2)}%`,
        isDynamicFee: hasSwapFeeModule,
        baseFeeBasisPoints: baseFeeRaw,
      };
    }

    // Basic pool: use default fees
    const feeBasisPoints = route.stable ? stableFee : volatileFee;
    return {
      route,
      feeBasisPoints,
      feePercent: feeBasisPoints / 10000,
      feeDisplay: `${(feeBasisPoints / 100).toFixed(2)}%`,
      isDynamicFee: false,
      baseFeeBasisPoints: feeBasisPoints,
    };
  });

  // [DEBUG] Per-route fee breakdown
  console.log("[usePoolFees] routes:", routes);
  console.log("[usePoolFees] fees per route:", fees?.map(f => ({
    from: f.route.from,
    to: f.route.to,
    stable: f.route.stable,
    feeBps: f.feeBasisPoints,
    feeDisplay: f.feeDisplay,
    isDynamicFee: f.isDynamicFee,
  })));

  const totalFeeBasisPoints =
    fees?.reduce((sum, f) => sum + f.feeBasisPoints, 0) || 0;
  const totalFeePercent = totalFeeBasisPoints / 10000;

  // [DEBUG] Total fee result
  console.log("[usePoolFees] totalFeeBasisPoints:", totalFeeBasisPoints, "totalFeeDisplay:", `${(totalFeeBasisPoints / 100).toFixed(2)}%`);

  return {
    fees,
    stableFee,
    volatileFee,
    totalFeeBasisPoints,
    totalFeePercent,
    totalFeeDisplay: `${(totalFeeBasisPoints / 100).toFixed(2)}%`,
  };
}
