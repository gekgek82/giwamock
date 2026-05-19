import { BadRequestException } from '@nestjs/common';

/**
 * Optional wei amount for `GET /swap-routes?amountIn=` — integer decimal string
 * in smallest units of the **from** token (same encoding as on-chain `uint256`).
 */
export function parseOptionalSwapRouteAmountInWei(
  raw: unknown,
): { wei: bigint; asString: string } | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== 'string') {
    throw new BadRequestException(
      'Query `amountIn` must be a base-10 integer string when set',
    );
  }
  const t = raw.trim();
  if (!t) {
    return null;
  }
  if (!/^\d+$/.test(t)) {
    throw new BadRequestException(
      'Query `amountIn` must be a base-10 integer string (token wei)',
    );
  }
  const wei = BigInt(t);
  if (wei <= 0n) {
    throw new BadRequestException('Query `amountIn` must be > 0 when set');
  }
  return { wei, asString: t };
}
