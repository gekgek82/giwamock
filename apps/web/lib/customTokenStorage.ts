import type { SpotTokenRecordDto, TokenInfo } from "@giwater/shared";

const STORAGE_KEY = "giwater-custom-tokens";
const TOKEN_INFO_KEY = "giwater-custom-token-infos";

type CustomTokenEntry = Pick<
  SpotTokenRecordDto,
  "id" | "symbol" | "name" | "decimals" | "logoURI"
>;

function readEntries(): CustomTokenEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomTokenEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomToken(token: SpotTokenRecordDto): void {
  if (typeof window === "undefined") return;
  const entries = readEntries().filter(
    (t) => t.id.toLowerCase() !== token.id.toLowerCase(),
  );
  entries.unshift({
    id: token.id,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    logoURI: token.logoURI,
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function getCustomTokens(): CustomTokenEntry[] {
  return readEntries();
}

export function saveCustomTokenInfo(token: TokenInfo): void {
  if (typeof window === "undefined") return;
  const entries = getCustomTokenInfos().filter(
    (t) => t.address.toLowerCase() !== token.address.toLowerCase(),
  );
  entries.unshift(token);
  localStorage.setItem(TOKEN_INFO_KEY, JSON.stringify(entries));
}

export function getCustomTokenInfos(): TokenInfo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TOKEN_INFO_KEY);
    return raw ? (JSON.parse(raw) as TokenInfo[]) : [];
  } catch {
    return [];
  }
}
