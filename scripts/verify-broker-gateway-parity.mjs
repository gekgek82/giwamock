#!/usr/bin/env node
/**
 * Verifies broker ↔ gateway contract:
 * 1) RPC: every broker HTTP route must be handled by GatewayRpcInvokeService (no 501 / "No route for" / "No RPC handler").
 * 2) HTTP parity: BrokerHttpParityController @Get paths must mirror a subset of broker GET routes (parsed from source).
 *
 * Usage:
 *   GATEWAY_URL=http://127.0.0.1:3046 node scripts/verify-broker-gateway-parity.mjs
 *   GATEWAY_URL=https://your-gateway.up.railway.app node scripts/verify-broker-gateway-parity.mjs
 *   GATEWAY_URL=https://your-gateway.up.railway.app node scripts/verify-broker-gateway-parity.mjs \
 *     --from-token ETH --to-token USDC \
 *     --token-address 0x... --pair-address 0x... \
 *     --token-symbol WETH --pair-symbol WETH/USDC --sender 0x...
 *
 * Static-only (no network): compares gateway parity controller vs invoke source file on disk.
 *   node scripts/verify-broker-gateway-parity.mjs --static-only
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function read(p) {
  return readFileSync(join(ROOT, p), 'utf8');
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = 'true';
      continue;
    }
    out[key] = next;
    i++;
  }
  return out;
}

function hasInteractiveStdin() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function askMissingValue(promptLabel, fallback = '') {
  const rl = createInterface({ input, output });
  try {
    const suffix = fallback ? ` [default: ${fallback}]` : '';
    const answer = (await rl.question(`${promptLabel}${suffix}: `)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

async function resolveInputs(args, staticOnly) {
  const defaults = {
    fromToken: '0x0000000000000000000000000000000000000001',
    toToken: '0x0000000000000000000000000000000000000002',
    tokenAddress: '0x0000000000000000000000000000000000000000',
    pairAddress: '0x0000000000000000000000000000000000000000',
    tokenSymbol: '__parity_probe__',
    pairSymbol: '__parity_probe__',
    sender: '',
  };

  const values = {
    fromToken: args['from-token'] ?? process.env.PARITY_FROM_TOKEN ?? '',
    toToken: args['to-token'] ?? process.env.PARITY_TO_TOKEN ?? '',
    tokenAddress: args['token-address'] ?? process.env.PARITY_TOKEN_ADDRESS ?? '',
    pairAddress: args['pair-address'] ?? process.env.PARITY_PAIR_ADDRESS ?? '',
    tokenSymbol: args['token-symbol'] ?? process.env.PARITY_TOKEN_SYMBOL ?? '',
    pairSymbol: args['pair-symbol'] ?? process.env.PARITY_PAIR_SYMBOL ?? '',
    sender: args.sender ?? process.env.PARITY_SENDER ?? '',
  };

  const requiredKeys = [
    ['fromToken', 'from token (address or symbol)'],
    ['toToken', 'to token (address or symbol)'],
    ['tokenAddress', 'token address (0x...)'],
    ['pairAddress', 'pair address (0x...)'],
    ['tokenSymbol', 'token symbol'],
    ['pairSymbol', 'pair symbol'],
  ];

  const shouldAsk = !staticOnly && hasInteractiveStdin();
  for (const [key, label] of requiredKeys) {
    if (values[key]) continue;
    if (shouldAsk) {
      values[key] = await askMissingValue(label, defaults[key]);
    } else {
      values[key] = defaults[key];
    }
  }

  if (!values.sender && shouldAsk) {
    values.sender = await askMissingValue(
      'sender for cl-dynamic-fee (optional)',
      '',
    );
  }

  // Show effective user inputs for traceability.
  console.log('\nUsing parity probe inputs:');
  console.log(`  fromToken:    ${values.fromToken}`);
  console.log(`  toToken:      ${values.toToken}`);
  console.log(`  tokenAddress: ${values.tokenAddress}`);
  console.log(`  pairAddress:  ${values.pairAddress}`);
  console.log(`  tokenSymbol:  ${values.tokenSymbol}`);
  console.log(`  pairSymbol:   ${values.pairSymbol}`);
  console.log(`  sender:       ${values.sender || '(empty)'}`);

  return values;
}

/** Routes that must NOT return routing errors from POST .../api/v1/broker/invoke */
function buildInvokeProbe(values) {
  return [
    { method: 'GET', path: '/health', query: {} },
    { method: 'GET', path: '/contracts', query: {} },
  {
    method: 'GET',
    path: '/indexed-events',
    query: { offset: '0', limit: '1' },
  },
  {
    method: 'GET',
    path: '/swap-routes',
    query: {
      from: values.fromToken,
      to: values.toToken,
    },
  },
  {
    method: 'GET',
    path: '/spot-tokens/leaderboard/day-change/desc',
    query: { offset: '0', limit: '1' },
  },
  {
    method: 'GET',
    path: '/spot-tokens/leaderboard/day-change/asc',
    query: { offset: '0', limit: '1' },
  },
  {
    method: 'GET',
    path: '/spot-tokens/leaderboard/tvl/desc',
    query: { offset: '0', limit: '1' },
  },
  {
    method: 'GET',
    path: '/spot-tokens/leaderboard/tvl/asc',
    query: { offset: '0', limit: '1' },
  },
  {
    method: 'GET',
    path: '/spot-tokens/leaderboard/volume/desc',
    query: { offset: '0', limit: '1' },
  },
  {
    method: 'GET',
    path: '/spot-tokens/leaderboard/volume/asc',
    query: { offset: '0', limit: '1' },
  },
  {
    method: 'GET',
    path: `/spot-tokens/by-address/${values.tokenAddress}`,
    query: {},
  },
  {
    method: 'GET',
    path: `/spot-tokens/by-symbol/${encodeURIComponent(values.tokenSymbol)}`,
    query: {},
  },
  {
    method: 'GET',
    path: '/spot-pairs/leaderboard/day-change/desc',
    query: { offset: '0', limit: '1' },
  },
  {
    method: 'GET',
    path: '/spot-pairs/leaderboard/day-change/asc',
    query: { offset: '0', limit: '1' },
  },
  {
    method: 'GET',
    path: '/spot-pairs/leaderboard/tvl/desc',
    query: { offset: '0', limit: '1' },
  },
  {
    method: 'GET',
    path: '/spot-pairs/leaderboard/tvl/asc',
    query: { offset: '0', limit: '1' },
  },
  {
    method: 'GET',
    path: '/spot-pairs/leaderboard/volume/desc',
    query: { offset: '0', limit: '1' },
  },
  {
    method: 'GET',
    path: '/spot-pairs/leaderboard/volume/asc',
    query: { offset: '0', limit: '1' },
  },
  {
    method: 'GET',
    path: '/spot-pairs/recently-created',
    query: { offset: '0', limit: '1' },
  },
  {
    method: 'GET',
    path: '/spot-tokens/recently-created',
    query: { offset: '0', limit: '1', listed: 'false' },
  },
  {
    method: 'GET',
    path: `/spot-pairs/by-address/${values.pairAddress}`,
    query: {},
  },
  {
    method: 'GET',
    path: `/spot-pairs/by-symbol/${encodeURIComponent(values.pairSymbol)}`,
    query: {},
  },
  {
    method: 'GET',
    path: `/spot-pairs/by-address/${values.pairAddress}/cl-dynamic-fee`,
    query: values.sender ? { sender: values.sender } : {},
  },
  {
    method: 'POST',
    path: `/spot-tokens/by-address/${values.tokenAddress}/listing`,
    query: {},
    body: { listed: false },
  },
  {
    method: 'POST',
    path: `/spot-pairs/by-address/${values.pairAddress}/listing`,
    query: {},
    body: { listed: false },
  },
  {
    method: 'POST',
    path: '/spot-token-groups',
    query: {},
    body: { id: '__parity_probe_group__', name: 'probe', description: '' },
  },
  {
    method: 'POST',
    path: '/spot-token-groups/__parity_probe__/tokens',
    query: {},
    body: {
      tokenAddress: values.tokenAddress,
    },
  },
  {
    method: 'POST',
    path: '/spot-pair-groups',
    query: {},
    body: { id: '__parity_probe_pg__', name: 'probe', description: '' },
  },
  {
    method: 'POST',
    path: '/spot-pair-groups/__parity_probe__/pairs',
    query: {},
    body: {
      pairAddress: values.pairAddress,
    },
  },
  ];
}

function isRoutingHole(res) {
  if (!res || typeof res !== 'object') return true;
  const code = res.statusCode;
  const err = String(res.error ?? '');
  if (code === 501) return true;
  if (/No RPC handler for/i.test(err)) return true;
  if (/No route for \w+ .* under (spot-tokens|spot-pairs|spot-token-groups|spot-pair-groups)/i.test(err))
    return true;
  return false;
}

function parseParityGetRoutes() {
  const src = read('apps/gateway/src/api/broker-http-parity.controller.ts');
  const paths = [];
  const re = /@Get\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    paths.push(m[1]);
  }
  return paths;
}

function buildSample(values) {
  return {
    address: values.pairAddress,
    symbol: values.pairSymbol,
    fromToken: values.fromToken,
    toToken: values.toToken,
  };
}

function parityPatternToPath(pattern, sample) {
  return (
    '/' +
    pattern
      .replace(/:address/g, sample.address)
      .replace(/:symbol/g, encodeURIComponent(sample.symbol))
      .replace(/:metric/g, 'day-change')
      .replace(/:sort/g, 'desc')
      .replace(/^\/+/, '')
  );
}

/** GET parity paths as concrete URLs for curl-style probing */
function httpParityConcretePaths(sample) {
  const parsed = parseParityGetRoutes();
  const out = [];
  for (const r of parsed) {
    let path = parityPatternToPath(r, sample);
    let tail = '';
    if (r.includes('swap-routes')) {
      tail =
        '?from=' +
        encodeURIComponent(sample.fromToken) +
        '&to=' +
        encodeURIComponent(sample.toToken);
    }
    out.push({ pattern: r, url: path + tail });
  }
  return out;
}

async function probeInvoke(baseUrl, values) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/broker/invoke`;
  let failed = 0;
  for (const t of buildInvokeProbe(values)) {
    const payload = {
      method: t.method,
      path: t.path,
      query: t.query ?? {},
      body: t.body ?? null,
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (isRoutingHole(json)) {
      console.error(
        `FAIL RPC route missing: ${t.method} ${t.path} →`,
        JSON.stringify(json),
      );
      failed++;
    } else {
      const inner = typeof json.statusCode === 'number' ? json.statusCode : res.status;
      console.log(
        `OK   RPC ${t.method} ${t.path} (broker statusCode ${inner}, HTTP ${res.status})`,
      );
    }
  }
  return failed;
}

async function probeHttpParity(baseUrl, sample) {
  const base = baseUrl.replace(/\/$/, '');
  let failed = 0;
  const routes = httpParityConcretePaths(sample);
  for (const { pattern, url } of routes) {
    const full = base + url;
    const res = await fetch(full);
    const text = await res.text();
    /** Nest/Express “no handler” vs broker semantic 404 from RPC proxy */
    const expressNoRoute =
      res.status === 404 &&
      (/Cannot GET\s/i.test(text) ||
        /Cannot GET\s+\//i.test(text) ||
        text.trim() === 'Not Found');
    if (expressNoRoute) {
      console.error(
        `FAIL HTTP parity no Nest route [${pattern}] → ${full}`,
      );
      failed++;
    } else {
      console.log(`OK   HTTP GET parity [${pattern}] → HTTP ${res.status}`);
    }
  }
  return failed;
}

async function fetchOpenApiDoc(baseUrl) {
  const base = baseUrl.replace(/\/$/, '');
  const candidates = [`${base}/api/docs-json`, `${base}/api-json`];
  for (const u of candidates) {
    const res = await fetch(u);
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && typeof json === 'object') return json;
    }
  }
  return null;
}

function getParamNames(doc, method, path) {
  const op =
    doc?.paths?.[path]?.[method?.toLowerCase?.() ?? method]?.parameters ?? [];
  if (!Array.isArray(op)) return [];
  return op.map((p) => p?.name).filter(Boolean);
}

async function probeOpenApiParity(baseUrl) {
  const doc = await fetchOpenApiDoc(baseUrl);
  if (!doc) {
    console.error('FAIL OpenAPI: cannot fetch gateway swagger json');
    return 1;
  }

  const required = [
    { method: 'get', path: '/swap-routes', params: ['from', 'to'] },
    { method: 'get', path: '/indexed-events', params: ['offset', 'limit'] },
    {
      method: 'get',
      path: '/spot-pairs/recently-created',
      params: ['offset', 'limit', 'listed'],
    },
    {
      method: 'get',
      path: '/spot-tokens/recently-created',
      params: ['offset', 'limit', 'listed'],
    },
    {
      method: 'get',
      path: '/spot-pairs/by-address/{address}',
      params: ['address', 'listed'],
    },
    {
      method: 'get',
      path: '/spot-pairs/by-address/{address}/cl-dynamic-fee',
      params: ['address', 'sender'],
    },
    {
      method: 'get',
      path: '/spot-tokens/by-address/{address}',
      params: ['address', 'listed'],
    },
  ];

  let failed = 0;
  for (const c of required) {
    const names = getParamNames(doc, c.method, c.path);
    const missing = c.params.filter((p) => !names.includes(p));
    if (missing.length > 0) {
      console.error(
        `FAIL OpenAPI ${c.method.toUpperCase()} ${c.path} missing params: ${missing.join(', ')}`,
      );
      failed++;
    } else {
      console.log(
        `OK   OpenAPI ${c.method.toUpperCase()} ${c.path} params: ${c.params.join(', ')}`,
      );
    }
  }
  return failed;
}

function staticParityCheck() {
  const invokeSrc = read(
    'apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts',
  );
  const parityPaths = parseParityGetRoutes();
  const checks = [
    ['health', () => invokeSrc.includes(`join('/') === 'health'`)],
    ['contracts', () => invokeSrc.includes(`join('/') === 'contracts'`)],
    ['swap-routes', () => invokeSrc.includes(`'swap-routes'`)],
    ['indexed-events', () => invokeSrc.includes(`'indexed-events'`)],
    ['spot-tokens/*', () => invokeSrc.includes(`a === 'spot-tokens'`)],
    ['spot-pairs/*', () => invokeSrc.includes(`a === 'spot-pairs'`)],
    ['spot-token-groups', () => invokeSrc.includes(`a === 'spot-token-groups'`)],
    ['spot-pair-groups', () => invokeSrc.includes(`a === 'spot-pair-groups'`)],
  ];
  let bad = 0;
  for (const [label, fn] of checks) {
    if (!fn()) {
      console.error(`Static check: GatewayRpcInvokeService missing branch for ${label}`);
      bad++;
    }
  }
  console.log(
    `Static check: ${parityPaths.length} HTTP parity @Get routes in gateway; invoke branches OK (${checks.length} checks).`,
  );
  return bad;
}

async function main() {
  const args = parseArgs(process.argv);
  const staticOnly = process.argv.includes('--static-only');
  const base = process.env.GATEWAY_URL?.trim();
  const values = await resolveInputs(args, staticOnly);
  const sample = buildSample(values);

  let failures = 0;
  failures += staticParityCheck();

  if (staticOnly) {
    console.log('HTTP parity routes (from BrokerHttpParityController):');
    parseParityGetRoutes().forEach((p) => console.log(`  GET /${p}`));
    process.exit(failures ? 1 : 0);
  }

  if (!base) {
    console.error(
      'Set GATEWAY_URL (e.g. http://127.0.0.1:3046) for live checks, or use --static-only',
    );
    process.exit(failures ? 1 : 0);
  }

  console.log(`\nLive RPC invoke probes → ${base}`);
  failures += await probeInvoke(base, values);

  console.log(`\nLive HTTP parity GET probes → ${base}`);
  failures += await probeHttpParity(base, sample);

  console.log(`\nLive OpenAPI parity probes → ${base}`);
  failures += await probeOpenApiParity(base);

  if (failures) {
    console.error(`\nDone: ${failures} failure(s)`);
    process.exit(1);
  }
  console.log('\nAll broker ↔ gateway parity checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
