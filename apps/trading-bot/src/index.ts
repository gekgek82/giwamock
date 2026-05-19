import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatUnits,
  http,
  parseUnits,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { startTelegramBot, type VolumeStats } from './telegram.js';

// ─── Config ──────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function parseInterval(raw: string | undefined, defaultMs: number, minMs = 500): number {
  const n = parseInt(raw ?? String(defaultMs), 10);
  return Number.isFinite(n) && n >= minMs ? n : defaultMs;
}

const pk = requireEnv('PRIVATE_KEY') as `0x${string}`;
const TOKEN0 = requireEnv('TOKEN0') as Address;
const TOKEN1 = requireEnv('TOKEN1') as Address;
const RPC_URL = requireEnv('RPC_URL');
const SWAP_INTERVAL_MS = parseInterval(process.env.SWAP_INTERVAL_MS, 2000);
const SWAP_AMOUNT = process.env.SWAP_AMOUNT ?? '1.0';
const STABLE = process.env.STABLE === 'true';
const SLIPPAGE_BPS = BigInt(parseInt(process.env.SLIPPAGE_BPS ?? '50', 10)); // default 0.5%
const MAX_CONSECUTIVE_ERRORS = parseInt(process.env.MAX_CONSECUTIVE_ERRORS ?? '5', 10);
const DEADLINE_SECONDS = 120n; // 2 minutes from block timestamp

const account = privateKeyToAccount(pk);
delete process.env.PRIVATE_KEY; // scrub from env after account construction

// ─── Contracts ────────────────────────────────────────────────────────────────

const UNIVERSAL_ROUTER: Address = '0xfde8f8C6830cc28D8B0e06e87556009Abbe32B19';
const LEGACY_ROUTER: Address = '0x5B199dbe0c2A3c42Fe9A8E6Ced335D9212bF3B26'; // quoting only
const POOL_FACTORY: Address = '0x2a810715Ef7f06B1e1BA8779cC1D01C82A201Dcc';

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
] as const;

const ROUTE_COMPONENTS = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'stable', type: 'bool' },
  { name: 'factory', type: 'address' },
] as const;

const ROUTER_ABI = [
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'routes', type: 'tuple[]', components: ROUTE_COMPONENTS },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'nonpayable',
  },
] as const;

const QUOTE_ABI = [
  {
    name: 'getAmountsOut',
    type: 'function',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'routes', type: 'tuple[]', components: ROUTE_COMPONENTS },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
  },
] as const;

// ─── Chain & clients ──────────────────────────────────────────────────────────

const giwaChain = defineChain({
  id: 91342,
  name: 'Giwa Sepolia',
  nativeCurrency: { name: 'GIWA', symbol: 'GIWA', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const publicClient = createPublicClient({ chain: giwaChain, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: giwaChain, transport: http(RPC_URL) });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

// ─── Volume tracking ──────────────────────────────────────────────────────────

const volumeStats: VolumeStats = {
  token0In: 0n,
  token1In: 0n,
  swapCount: 0,
  startedAt: new Date(),
};

// ─── Startup validation ───────────────────────────────────────────────────────

async function validateStartup(decimals0: number, decimals1: number): Promise<void> {
  // Verify TOKEN0 and TOKEN1 are deployed contracts
  const [code0, code1] = await Promise.all([
    publicClient.getCode({ address: TOKEN0 }),
    publicClient.getCode({ address: TOKEN1 }),
  ]);
  if (!code0 || code0 === '0x') throw new Error(`TOKEN0 ${TOKEN0} is not a deployed contract`);
  if (!code1 || code1 === '0x') throw new Error(`TOKEN1 ${TOKEN1} is not a deployed contract`);

  // Warn on low native gas balance
  const nativeBalance = await publicClient.getBalance({ address: account.address });
  const LOW_GAS_THRESHOLD = parseUnits('0.01', 18);
  if (nativeBalance < LOW_GAS_THRESHOLD) {
    log(`Warning: Low native GIWA balance (${formatUnits(nativeBalance, 18)} GIWA). Bot may run out of gas.`);
  } else {
    log(`Native balance: ${formatUnits(nativeBalance, 18)} GIWA`);
  }

  // Log token balances
  const [bal0, bal1] = await Promise.all([
    publicClient.readContract({ address: TOKEN0, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }),
    publicClient.readContract({ address: TOKEN1, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }),
  ]);
  log(`TOKEN0 balance: ${formatUnits(bal0, decimals0)}`);
  log(`TOKEN1 balance: ${formatUnits(bal1, decimals1)}`);
}

// ─── Approval ─────────────────────────────────────────────────────────────────

// Approve exactly amountIn per swap — re-read on-chain each time to stay accurate.
// Avoids infinite allowances while keeping gas reasonable.
async function ensureApproval(token: Address, amountIn: bigint): Promise<void> {
  const allowance = await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, UNIVERSAL_ROUTER],
  });

  if (allowance >= amountIn) return;

  log(`Approving ${token} for ${amountIn.toString()} wei...`);
  const hash = await walletClient.writeContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [UNIVERSAL_ROUTER, amountIn], // approve exactly what's needed
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`Approval reverted: ${hash}`);
  log(`Approved: ${hash}`);
}

// ─── Quote ────────────────────────────────────────────────────────────────────

async function quoteAmountOut(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
): Promise<bigint> {
  try {
    const routes = [{ from: tokenIn, to: tokenOut, stable: STABLE, factory: POOL_FACTORY }];
    const amounts = await publicClient.readContract({
      address: LEGACY_ROUTER,
      abi: QUOTE_ABI,
      functionName: 'getAmountsOut',
      args: [amountIn, routes],
    });
    return amounts[amounts.length - 1] as bigint;
  } catch {
    log('Warning: quote unavailable — swap will proceed with amountOutMin = 0 (testnet only)');
    return 0n;
  }
}

// ─── Swap ─────────────────────────────────────────────────────────────────────

async function executeSwap(tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<void> {
  const routes = [{ from: tokenIn, to: tokenOut, stable: STABLE, factory: POOL_FACTORY }];

  // Use on-chain block timestamp as deadline base to avoid local clock skew
  const block = await publicClient.getBlock();
  const deadline = block.timestamp + DEADLINE_SECONDS;

  const expectedOut = await quoteAmountOut(tokenIn, tokenOut, amountIn);
  const amountOutMin = expectedOut > 0n ? (expectedOut * (10000n - SLIPPAGE_BPS)) / 10000n : 0n;

  const hash = await walletClient.writeContract({
    address: UNIVERSAL_ROUTER,
    abi: ROUTER_ABI,
    functionName: 'swapExactTokensForTokens',
    args: [amountIn, amountOutMin, routes, account.address, deadline],
  });

  log(`Swap submitted: ${hash} (minOut: ${amountOutMin.toString()})`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`Swap reverted: ${hash}`);
  log(`Confirmed in block ${receipt.blockNumber} (${tokenIn.slice(0, 8)}→${tokenOut.slice(0, 8)})`);
}

// ─── Main loop ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log('Trading bot starting...');
  log(`Wallet  : ${account.address}`);
  log(`TOKEN0  : ${TOKEN0}`);
  log(`TOKEN1  : ${TOKEN1}`);
  log(`Interval: ${SWAP_INTERVAL_MS}ms`);
  log(`Amount  : ${SWAP_AMOUNT}`);
  log(`Pool    : ${STABLE ? 'stable' : 'volatile'}`);
  log(`Slippage: ${SLIPPAGE_BPS} bps`);

  const [decimals0, decimals1] = await Promise.all([
    publicClient.readContract({ address: TOKEN0, abi: ERC20_ABI, functionName: 'decimals' }),
    publicClient.readContract({ address: TOKEN1, abi: ERC20_ABI, functionName: 'decimals' }),
  ]);

  await validateStartup(decimals0, decimals1);
  log('Startup validation passed. Starting swap loop...');

  // Start Telegram bot if token is configured
  const tgToken = process.env.TG_BOT_TOKEN;
  if (tgToken) {
    startTelegramBot({
      token: tgToken,
      walletAddress: account.address,
      token0: TOKEN0,
      token1: TOKEN1,
      swapIntervalMs: SWAP_INTERVAL_MS,
      swapAmount: SWAP_AMOUNT,
      stable: STABLE,
      slippageBps: SLIPPAGE_BPS,
      decimals0,
      decimals1,
      getBalances: async () => {
        const [native, token0, token1] = await Promise.all([
          publicClient.getBalance({ address: account.address }),
          publicClient.readContract({ address: TOKEN0, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }),
          publicClient.readContract({ address: TOKEN1, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }),
        ]);
        return { native, token0, token1 };
      },
      getVolume: () => ({ ...volumeStats }),
    });
    log('Telegram bot started.');
  }

  let direction = 0; // 0 = TOKEN0→TOKEN1, 1 = TOKEN1→TOKEN0
  let consecutiveErrors = 0;
  let shuttingDown = false;

  process.on('SIGINT', () => { log('Shutdown signal received (SIGINT). Finishing current cycle...'); shuttingDown = true; });
  process.on('SIGTERM', () => { log('Shutdown signal received (SIGTERM). Finishing current cycle...'); shuttingDown = true; });

  while (!shuttingDown) {
    try {
      const tokenIn = direction === 0 ? TOKEN0 : TOKEN1;
      const tokenOut = direction === 0 ? TOKEN1 : TOKEN0;
      const decimals = direction === 0 ? decimals0 : decimals1;
      const amountIn = parseUnits(SWAP_AMOUNT, decimals);

      const balance = await publicClient.readContract({
        address: tokenIn,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      });

      if (balance < amountIn) {
        log(
          `Low balance on ${tokenIn.slice(0, 8)}...: have ${formatUnits(balance, decimals)}, need ${SWAP_AMOUNT}. Skipping.`,
        );
      } else {
        await ensureApproval(tokenIn, amountIn);
        await executeSwap(tokenIn, tokenOut, amountIn);
        // Track volume after confirmed swap
        if (direction === 0) volumeStats.token0In += amountIn;
        else volumeStats.token1In += amountIn;
        volumeStats.swapCount += 1;
      }

      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors += 1;
      log(`Error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${err instanceof Error ? err.message : String(err)}`);
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        log('Circuit breaker tripped — too many consecutive errors. Exiting.');
        process.exit(1);
      }
      const backoffMs = SWAP_INTERVAL_MS * Math.min(2 ** consecutiveErrors, 16);
      log(`Backing off ${backoffMs}ms...`);
      await sleep(backoffMs);
      continue;
    } finally {
      // Always flip direction so a revert on one side doesn't lock the bot
      direction = 1 - direction;
    }

    await sleep(SWAP_INTERVAL_MS);
  }

  log('Bot shut down gracefully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
