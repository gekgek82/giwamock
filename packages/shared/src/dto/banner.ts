/**
 * Public Banner DTO Types
 *
 * Types for the public-facing banner API endpoints.
 */

import type { BannerClickTarget } from '../types/banner';

export interface ActiveBanner {
  id: number;
  imagePcUrl: string | null;
  imageMobileUrl: string | null;
  linkUrl: string | null;
  clickTarget: BannerClickTarget;
}
