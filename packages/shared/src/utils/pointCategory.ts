import type { PointEarningCategory } from '../dto/portfolio';

export type PointSector = 'LP' | 'TRADE' | 'REFERRAL' | 'EMISSION';

export function sectorToCategory(
  sector: PointSector,
  eventType: string | null | undefined,
): PointEarningCategory {
  if (eventType) return 'EVENT';
  switch (sector) {
    case 'LP':
      return 'LIQUIDITY_STAKING';
    case 'TRADE':
      return 'SWAP';
    case 'REFERRAL':
    case 'EMISSION':
    default:
      return 'EVENT';
  }
}

/**
 * Returns the set of sectors that match the given category, or null if no
 * sector-level filter is needed (All). Caller must additionally OR in the
 * `event_type IS NOT NULL` predicate for EVENT to include admin-tagged rows.
 */
export function categoryToSectors(
  category: PointEarningCategory | undefined,
): PointSector[] | null {
  if (!category) return null;
  switch (category) {
    case 'LIQUIDITY_STAKING':
      return ['LP'];
    case 'SWAP':
      return ['TRADE'];
    case 'EVENT':
      return ['REFERRAL', 'EMISSION'];
  }
}

export function isEventRow(
  sector: PointSector,
  eventType: string | null | undefined,
): boolean {
  return !!eventType || sector === 'REFERRAL' || sector === 'EMISSION';
}
