export const BannerStatus = {
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
} as const;
export type BannerStatus = (typeof BannerStatus)[keyof typeof BannerStatus];

export const BannerPage = {
  SWAP: 'SWAP',
  LIQUIDITY: 'LIQUIDITY',
  LOCK: 'LOCK',
  PORTFOLIO: 'PORTFOLIO',
} as const;
export type BannerPage = (typeof BannerPage)[keyof typeof BannerPage];

export const BannerClickTarget = {
  NEW_TAB: 'NEW_TAB',
  CURRENT_TAB: 'CURRENT_TAB',
} as const;
export type BannerClickTarget =
  (typeof BannerClickTarget)[keyof typeof BannerClickTarget];
