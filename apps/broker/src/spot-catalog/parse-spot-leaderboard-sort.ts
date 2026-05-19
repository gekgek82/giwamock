import { BadRequestException } from '@nestjs/common';
import type { SpotLeaderboardSort } from './spot-catalog.service';

export function parseSpotLeaderboardSortParam(raw: string): SpotLeaderboardSort {
  const s = (typeof raw === 'string' ? raw : '').trim().toLowerCase();
  if (s === 'asc' || s === 'desc') return s;
  throw new BadRequestException('Path parameter `sort` must be `asc` or `desc`');
}
