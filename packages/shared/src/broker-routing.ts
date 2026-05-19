export type BrokerTarget = 'broker' | 'config';

export const BROKER_ROUTE_REGISTRY: Array<{ pattern: RegExp; target: BrokerTarget }> = [
  { pattern: /^\/banners(\/|$)/, target: 'config' },
  { pattern: /^\/referral(\/|$)/, target: 'config' },
  { pattern: /^\/admin\/watched-wallets(\/|$)/, target: 'config' },
  { pattern: /^\/token-faucets(\/|$)/, target: 'config' },
];

export function resolveBrokerTarget(path: string): BrokerTarget {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return BROKER_ROUTE_REGISTRY.find(({ pattern }) => pattern.test(normalized))?.target ?? 'broker';
}
