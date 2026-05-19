/**
 * Parse known contract revert reasons from error messages.
 * Returns the i18n key if a known reason is found, or null.
 */

const REVERT_REASONS: Record<string, string> = {
  PS: "revertPS",
  TD: "revertTD",
  AM: "revertAM",
  M0: "revertM0",
  M1: "revertM1",
  NP: "revertNP",
  LO: "revertLO",
  TLU: "revertTLU",
  TLM: "revertTLM",
  TUM: "revertTUM",
  AI: "revertAI",
  LOK: "revertLOK",
  TS: "revertTS",
  IT: "revertIT",
  PE: "revertPE",
  STE: "revertSTE",
  LS: "revertLS",
  LA: "revertLA",
};

export function parseRevertReason(errorMessage: string): string | null {
  for (const [code, key] of Object.entries(REVERT_REASONS)) {
    if (
      errorMessage.includes(`reverted: ${code}.`) ||
      errorMessage.includes(`reverted: ${code}`)
    ) {
      return `errors.${key}`;
    }
  }
  // Solidity 0.8.x panic codes
  if (errorMessage.includes("panic") && errorMessage.includes("0x11")) {
    return "errors.executionReverted";
  }
  return null;
}

/**
 * Extract a human-readable revert reason from an error message.
 * Handles formats like:
 *   - "reverted with the following reason: ERC20: transfer amount exceeds balance"
 *   - "execution reverted: ERC20: transfer amount exceeds balance"
 *   - "reverted with reason: ..."
 */
export function extractRevertReason(errorMessage: string): string | null {
  const match = errorMessage.match(
    /(?:reverted with the following reason:\s*|reverted(?:\s*with)?\s*(?:reason\s*)?:\s*)(.+?)(?:\n|$)/i
  );
  const reason = match?.[1]?.trim();
  if (reason && reason.length > 0 && reason.length < 200) return reason;
  return null;
}
