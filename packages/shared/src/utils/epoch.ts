/**
 * Epoch utility functions mirroring on-chain ProtocolTimeLibrary.sol
 *
 * On-chain logic: epochStart = timestamp - (timestamp % WEEK)
 * This uses Unix epoch 0 (1970-01-01 Thursday 00:00 UTC) as the implicit base,
 * dividing time into 7-day (604800-second) windows aligned to Thursdays.
 */

const WEEK = 7 * 24 * 60 * 60; // 604800 seconds

/**
 * Get the epoch start timestamp (Thursday 00:00 UTC) for a given unix timestamp (seconds).
 */
export function epochStart(timestampSec: number): number {
  return timestampSec - (timestampSec % WEEK);
}

/**
 * Get the next epoch start timestamp for a given unix timestamp (seconds).
 */
export function epochNext(timestampSec: number): number {
  return timestampSec - (timestampSec % WEEK) + WEEK;
}

/**
 * Get the voting window start (epoch start + 1 hour) for a given unix timestamp.
 */
export function epochVoteStart(timestampSec: number): number {
  return timestampSec - (timestampSec % WEEK) + 3600;
}

/**
 * Get the voting window end (epoch end - 1 hour) for a given unix timestamp.
 */
export function epochVoteEnd(timestampSec: number): number {
  return timestampSec - (timestampSec % WEEK) + WEEK - 3600;
}

/**
 * Get the epoch number for a given unix timestamp (seconds).
 * Epoch 0 starts at Unix epoch 0 (1970-01-01 00:00 UTC).
 */
export function getEpochNumber(timestampSec: number): number {
  return Math.floor(timestampSec / WEEK);
}

/**
 * Get the epoch number from a Date object.
 */
export function getEpochFromDate(date: Date): number {
  return getEpochNumber(Math.floor(date.getTime() / 1000));
}

/**
 * Get the current epoch number.
 */
export function getCurrentEpochNumber(): number {
  return getEpochNumber(Math.floor(Date.now() / 1000));
}

/**
 * Get the current epoch start timestamp (seconds).
 */
export function getCurrentEpochStart(): number {
  return epochStart(Math.floor(Date.now() / 1000));
}

/**
 * Get the current epoch end timestamp (seconds).
 */
export function getCurrentEpochEnd(): number {
  return epochNext(Math.floor(Date.now() / 1000));
}

/**
 * Get epoch start timestamp (seconds) for a given epoch number.
 */
export function getEpochStartByNumber(epoch: number): number {
  return epoch * WEEK;
}

/**
 * Get epoch end timestamp (seconds) for a given epoch number.
 */
export function getEpochEndByNumber(epoch: number): number {
  return (epoch + 1) * WEEK;
}

/**
 * Get epoch end as a Date for a given epoch number.
 */
export function getEpochEndDate(epoch: number): Date {
  return new Date(getEpochEndByNumber(epoch) * 1000);
}

/**
 * Seconds remaining until the current epoch ends.
 */
export function getEpochRemainingSeconds(): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, epochNext(now) - now);
}

export const EPOCH_DURATION = WEEK;
