/**
 * Pool Grade System
 *
 * Lv.1 Verified - Voting enabled, green check badge
 * Lv.2 Rising   - Voting disabled, black check badge
 * Lv.3 Unknown  - Voting disabled, no badge
 */
export const PoolGrade = {
  VERIFIED: 1,
  RISING: 2,
  UNKNOWN: 3,
} as const;
export type PoolGrade = (typeof PoolGrade)[keyof typeof PoolGrade];
