import { Bot } from 'grammy';
import { formatUnits, type Address } from 'viem';

export interface VolumeStats {
  token0In: bigint;  // TOKEN0 spent (direction 0→1)
  token1In: bigint;  // TOKEN1 spent (direction 1→0)
  swapCount: number;
  startedAt: Date;
}

function formatUptime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

export function startTelegramBot(params: {
  token: string;
  walletAddress: Address;
  token0: Address;
  token1: Address;
  swapIntervalMs: number;
  swapAmount: string;
  stable: boolean;
  slippageBps: bigint;
  decimals0: number;
  decimals1: number;
  getBalances: () => Promise<{ native: bigint; token0: bigint; token1: bigint }>;
  getVolume: () => VolumeStats;
}): void {
  const bot = new Bot(params.token);

  const helpText = [
    '🤖 *Trading Bot*',
    '',
    'Commands:',
    '/balances — Wallet balances (gas + tokens)',
    '/volumes — Volume stats and uptime',
    '/config — Bot configuration',
    '/help — Show this message',
  ].join('\n');

  bot.command('start', (ctx) => ctx.reply(helpText, { parse_mode: 'Markdown' }));
  bot.command('help', (ctx) => ctx.reply(helpText, { parse_mode: 'Markdown' }));

  bot.command('balances', async (ctx) => {
    try {
      const { native, token0, token1 } = await params.getBalances();
      await ctx.reply(
        [
          '💰 *Wallet Balances*',
          `\`${params.walletAddress}\``,
          '',
          `⛽ GIWA (gas): \`${formatUnits(native, 18)}\``,
          `🔵 TOKEN0 \`${params.token0.slice(0, 10)}…\`: \`${formatUnits(token0, params.decimals0)}\``,
          `🟡 TOKEN1 \`${params.token1.slice(0, 10)}…\`: \`${formatUnits(token1, params.decimals1)}\``,
        ].join('\n'),
        { parse_mode: 'Markdown' },
      );
    } catch (err) {
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  bot.command('volumes', async (ctx) => {
    const vol = params.getVolume();
    await ctx.reply(
      [
        '📊 *Volume Stats*',
        '',
        `Swaps completed: \`${vol.swapCount}\``,
        `TOKEN0 sold: \`${formatUnits(vol.token0In, params.decimals0)}\``,
        `TOKEN1 sold: \`${formatUnits(vol.token1In, params.decimals1)}\``,
        `Uptime: \`${formatUptime(Date.now() - vol.startedAt.getTime())}\``,
        `Started: \`${vol.startedAt.toISOString()}\``,
      ].join('\n'),
      { parse_mode: 'Markdown' },
    );
  });

  bot.command('config', async (ctx) => {
    await ctx.reply(
      [
        '⚙️ *Bot Configuration*',
        '',
        `Swap interval: \`${params.swapIntervalMs}ms\``,
        `Swap amount: \`${params.swapAmount}\``,
        `TOKEN0: \`${params.token0}\``,
        `TOKEN1: \`${params.token1}\``,
        `Pool type: \`${params.stable ? 'stable' : 'volatile'}\``,
        `Slippage: \`${params.slippageBps} bps (${Number(params.slippageBps) / 100}%)\``,
      ].join('\n'),
      { parse_mode: 'Markdown' },
    );
  });

  // Start polling in the background (non-blocking)
  bot.start().catch((err) => console.error('[Telegram] Bot error:', err));
}
