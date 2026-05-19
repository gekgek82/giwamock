export type SwapRouteHopPoolKind = 'volatile' | 'stable' | 'cl';

/**
 * Swap fee in **basis points** (1 bps = 0.01%) used for route quotes and display.
 * Matches broker logic: `spot_pairs.effectiveFeeBps` when set; else factory tier
 * defaults for volatile vs stable; else 30 (volatile/CL) or 5 (stable).
 */
export function resolveSwapRouteHopFeeBps(params: {
  effectiveFeeBps: number | null;
  poolKind: SwapRouteHopPoolKind;
  factoryVolatileFeeBps?: number | null;
  factoryStableFeeBps?: number | null;
}): number {
  const {
    effectiveFeeBps,
    poolKind,
    factoryVolatileFeeBps,
    factoryStableFeeBps,
  } = params;
  if (
    effectiveFeeBps !== null &&
    effectiveFeeBps !== undefined &&
    Number.isFinite(effectiveFeeBps)
  ) {
    return Math.max(0, Math.round(effectiveFeeBps));
  }
  const stable = poolKind === 'stable';
  const tier = stable ? factoryStableFeeBps : factoryVolatileFeeBps;
  if (tier !== null && tier !== undefined && Number.isFinite(tier)) {
    return Math.max(0, Math.round(tier));
  }
  return stable ? 5 : 30;
}
