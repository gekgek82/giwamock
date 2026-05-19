import { createPublicClient, http } from "viem";
import { NonfungiblePositionManagerAbi, NFT_POSITION_MANAGER_ADDRESS } from "@giwater/shared";

const rpcUrl = process.env.PONDER_RPC_URL_1 ?? "";
const client = rpcUrl
  ? createPublicClient({ transport: http(rpcUrl) })
  : null;

export interface NfpmPosition {
  token0: `0x${string}`;
  token1: `0x${string}`;
  tickSpacing: bigint;
  tickLower: bigint;
  tickUpper: bigint;
  liquidity: bigint;
}

export async function resolveNfpmPosition(
  tokenId: bigint,
): Promise<NfpmPosition | null> {
  if (!client) return null;
  try {
    const result = await client.readContract({
      address: NFT_POSITION_MANAGER_ADDRESS,
      abi: NonfungiblePositionManagerAbi,
      functionName: "positions",
      args: [tokenId],
    });
    const r = result as {
      token0: `0x${string}`;
      token1: `0x${string}`;
      tickSpacing: number;
      tickLower: number;
      tickUpper: number;
      liquidity: bigint;
    };
    return {
      token0: r.token0.toLowerCase() as `0x${string}`,
      token1: r.token1.toLowerCase() as `0x${string}`,
      tickSpacing: BigInt(r.tickSpacing),
      tickLower: BigInt(r.tickLower),
      tickUpper: BigInt(r.tickUpper),
      liquidity: r.liquidity,
    };
  } catch {
    return null;
  }
}
