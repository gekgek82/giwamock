/**
 * Convert a finite UI float (e.g. `spot_pairs.baseLiquidity`) to integer wei.
 * Best-effort for values within safe float range; very large magnitudes may lose precision.
 */
export function uiDoubleToWei(ui: number, decimals: number): bigint {
  if (!Number.isFinite(ui) || ui <= 0) {
    return 0n;
  }
  const dec = Math.min(Math.max(0, Math.floor(decimals)), 78);
  const scale = 10n ** BigInt(dec);
  const integral = Math.floor(ui);
  const fractional = ui - integral;
  let out = BigInt(integral) * scale;
  const fracScaled = fractional * Number(scale);
  if (Number.isFinite(fracScaled)) {
    out += BigInt(Math.round(fracScaled));
  }
  return out;
}
