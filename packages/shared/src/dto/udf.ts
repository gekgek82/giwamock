export interface UdfConfigResponseDto {
  supported_resolutions: string[];
  exchanges: { value: string; name: string; desc: string }[];
  symbols_types: { name: string; value: string }[];
  supports_search: boolean;
  supports_group_request: boolean;
  supports_marks: boolean;
  supports_timescale_marks: boolean;
  supports_time: boolean;
}

export interface UdfSymbolInfoDto {
  name: string;
  ticker: string;
  description: string;
  type: 'pair' | 'token';
  exchange: string;
  listed_exchange: string;
  timezone: string;
  session: string;
  minmov: number;
  pricescale: number;
  has_intraday: boolean;
  has_daily: boolean;
  has_weekly_and_monthly: boolean;
  supported_resolutions: string[];
  volume_precision: number;
  data_status: string;
}

export interface UdfSearchResultItemDto {
  symbol: string;
  full_name: string;
  description: string;
  exchange: string;
  ticker: string;
  type: 'pair' | 'token';
}

export interface UdfHistoryResponseDto {
  s: 'ok' | 'no_data' | 'error';
  t?: number[];
  o?: number[];
  h?: number[];
  l?: number[];
  c?: number[];
  v?: number[];
  errmsg?: string;
}
