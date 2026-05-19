import { createPublicClient, http } from "viem";

const rpcUrl = process.env.PONDER_RPC_URL_1 ?? "";
const client = rpcUrl
  ? createPublicClient({
      transport: http(rpcUrl),
    })
  : null;

const TOKEN0_TOKEN1_ABI = [
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export async function resolvePoolTokenAddresses(
  pool: `0x${string}`,
): Promise<{ token0: `0x${string}`; token1: `0x${string}` } | null> {
  if (!client) return null;
  try {
    const [token0, token1] = await Promise.all([
      client.readContract({
        address: pool,
        abi: TOKEN0_TOKEN1_ABI,
        functionName: "token0",
      }),
      client.readContract({
        address: pool,
        abi: TOKEN0_TOKEN1_ABI,
        functionName: "token1",
      }),
    ]);
    if (
      typeof token0 === "string" &&
      typeof token1 === "string" &&
      token0.startsWith("0x") &&
      token1.startsWith("0x")
    ) {
      return {
        token0: token0.toLowerCase() as `0x${string}`,
        token1: token1.toLowerCase() as `0x${string}`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

