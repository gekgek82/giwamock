import { Injectable, Logger } from '@nestjs/common';
import type { Socket } from 'socket.io';

/**
 * Allowed Socket.IO room names:
 * - on-chain: `pair:0x…`, `token:0x…`
 * - catalog: `spot-tokens:leaderboards` (server-pushed leaderboard snapshots)
 */
const CHANNEL_RE =
  /^(?:(?:pair|token):0x[a-fA-F0-9]{40}|spot-tokens:leaderboards)$/;

@Injectable()
export class WsClientChannelsService {
  private readonly logger = new Logger(WsClientChannelsService.name);

  parseChannelList(body: unknown): string[] {
    if (Array.isArray(body)) {
      return body.filter((x): x is string => typeof x === 'string');
    }
    if (typeof body === 'object' && body !== null) {
      const ch = (body as { channels?: unknown }).channels;
      if (Array.isArray(ch)) {
        return ch.filter((x): x is string => typeof x === 'string');
      }
    }
    return [];
  }

  isAllowedChannel(channel: string): boolean {
    return CHANNEL_RE.test(channel.trim());
  }

  /**
   * Joins each valid channel room; returns the list actually joined (deduped).
   */
  subscribe(client: Socket, rawChannels: string[]): string[] {
    const joined = new Set<string>();
    for (const raw of rawChannels) {
      const c = raw.trim();
      if (!this.isAllowedChannel(c)) {
        this.logger.debug(`Rejecting invalid channel from ${client.id}: ${raw}`);
        continue;
      }
      void client.join(c);
      joined.add(c);
    }
    return [...joined];
  }

  unsubscribe(client: Socket, rawChannels: string[]): string[] {
    const left = new Set<string>();
    for (const raw of rawChannels) {
      const c = raw.trim();
      if (!this.isAllowedChannel(c)) continue;
      void client.leave(c);
      left.add(c);
    }
    return [...left];
  }
}
