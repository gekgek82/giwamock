import { BadRequestException } from '@nestjs/common';

/**
 * HTTP/RPC query `listed` → exact boolean for `WHERE … = :listed`.
 *
 * - Omitted / empty → `defaultValue` (per-endpoint default).
 * - `true` / `1` → `true` (only rows with `listed === true`).
 * - `false` / `0` → `false` (only rows with `listed === false`).
 */
export function parseListedQueryParam(
  value: string | string[] | boolean | number | undefined,
  defaultValue = true,
): boolean {
  const head = Array.isArray(value) ? value[0] : value;
  if (head === undefined || head === '') {
    return defaultValue;
  }
  if (typeof head === 'boolean') {
    return head;
  }
  if (typeof head === 'number') {
    if (head === 0) return false;
    if (head === 1) return true;
    throw new BadRequestException(
      'Query parameter `listed` must be 0 or 1 when sent as a number',
    );
  }
  const s = String(head).toLowerCase().trim();
  if (s === 'true' || s === '1') {
    return true;
  }
  if (s === 'false' || s === '0') {
    return false;
  }
  throw new BadRequestException(
    'Query parameter `listed` must be true, false, 1, or 0 when provided',
  );
}

export function parseListedFromQueryRecord(
  q: Record<string, string | boolean | number | undefined> | undefined,
  defaultValue = true,
): boolean {
  return parseListedQueryParam(q?.['listed'], defaultValue);
}
