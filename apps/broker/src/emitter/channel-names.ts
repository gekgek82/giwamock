const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

export function hexAddrLower(addr: string): string | null {
  const a = addr.trim();
  if (!ADDR_RE.test(a)) return null;
  return a.toLowerCase();
}

export function pairChannel(pool: string): string | null {
  const p = hexAddrLower(pool);
  return p ? `pair:${p}` : null;
}

export function tokenChannel(token: string): string | null {
  const t = hexAddrLower(token);
  return t ? `token:${t}` : null;
}
