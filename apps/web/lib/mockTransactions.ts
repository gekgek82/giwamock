import { MOCK_DATA_ENABLED } from "@/lib/config";

export const MOCK_DEMO_ADDRESS =
  "0x0000000000000000000000000000000000000abc" as const;

export type MockTransactionOutcome = "success" | "failed" | "rejected";

export interface SimulateMockTransactionOptions {
  label: string;
  delayMs?: number;
  outcome?: MockTransactionOutcome;
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function expandHex(seed: string, length: number): string {
  let out = "";
  let nonce = 0;
  while (out.length < length) {
    out += fnv1a(`${seed}:${nonce}`);
    nonce += 1;
  }
  return out.slice(0, length);
}

export function createMockTxHash(label: string, nonce = 0): `0x${string}` {
  return `0x${expandHex(`giwater:tx:${label}:${nonce}`, 64)}`;
}

export function createMockSignature(input: {
  address?: string;
  message: string;
}): `0x${string}` {
  const address = input.address ?? MOCK_DEMO_ADDRESS;
  return `0x${expandHex(`giwater:sig:${address}:${input.message}`, 130)}`;
}

export function isMockMode(): boolean {
  return MOCK_DATA_ENABLED;
}

export function getMockDemoAddress(): `0x${string}` | undefined {
  return MOCK_DATA_ENABLED ? MOCK_DEMO_ADDRESS : undefined;
}

export async function simulateMockTransaction({
  label,
  delayMs = 350,
  outcome = "success",
}: SimulateMockTransactionOptions): Promise<`0x${string}`> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  if (outcome === "rejected") {
    throw new Error("User rejected mock transaction");
  }
  if (outcome === "failed") {
    throw new Error("Mock transaction failed");
  }

  return createMockTxHash(label, Date.now());
}
