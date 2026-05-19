import type { SwapIndexerBrokerPayload } from '@giwater/shared';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrokerSwapHopEntity } from '../models/swap/broker-swap-hop.entity';

function lc(s: string): string {
  return s.trim().toLowerCase();
}

function asWireString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

function parseNonNegInt(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 2147483647) {
    return null;
  }
  return Math.trunc(n);
}

@Injectable()
export class BrokerSwapHopMaterializationService {
  private readonly logger = new Logger(BrokerSwapHopMaterializationService.name);

  constructor(
    @InjectRepository(BrokerSwapHopEntity)
    private readonly repo: Repository<BrokerSwapHopEntity>,
  ) {}

  /**
   * Idempotent upsert from indexer queue payload.
   * Call only after {@link aggregateSwap} (OHLCV / pair-token metrics) succeeds.
   */
  async upsertFromSwapPayload(payload: unknown): Promise<void> {
    if (typeof payload !== 'object' || payload === null) return;
    const p = payload as Record<string, unknown>;
    if (p.type !== 'Swap') return;

    const row = this.tryMapToEntity(p as unknown as SwapIndexerBrokerPayload);
    if (!row) {
      this.logger.warn(
        'Skipping swap_hops upsert: invalid or incomplete Swap payload',
      );
      return;
    }

    await this.repo.upsert(row, { conflictPaths: ['id'] });
  }

  private tryMapToEntity(
    p: SwapIndexerBrokerPayload,
  ): BrokerSwapHopEntity | null {
    const id = asWireString(p.id);
    const sender = p.sender ? lc(p.sender) : undefined;
    const recipient = p.to ? lc(p.to) : undefined;
    const tokenIn = p.tokenIn ? lc(p.tokenIn) : undefined;
    const tokenOut = p.tokenOut ? lc(p.tokenOut) : undefined;
    const feeToken = p.feeToken ? lc(p.feeToken) : undefined;
    const tx = p.transactionHash ? lc(p.transactionHash) : undefined;

    const hopIndexStr = asWireString(p.hopIndex);
    const logIndexStr = asWireString(p.logIndex);
    const amountIn = asWireString(p.amountIn);
    const amountOut = asWireString(p.amountOut);
    const feeAmount = asWireString(p.feeAmount);
    const blockNumber = asWireString(p.blockNumber);
    const blockTimestamp = asWireString(p.blockTimestamp);

    if (
      !id ||
      !sender ||
      !recipient ||
      !tokenIn ||
      !tokenOut ||
      typeof p.isCL !== 'boolean' ||
      typeof p.stable !== 'boolean' ||
      !hopIndexStr ||
      !logIndexStr ||
      !amountIn ||
      !amountOut ||
      !feeAmount ||
      !feeToken ||
      !tx ||
      !blockNumber ||
      !blockTimestamp
    ) {
      return null;
    }

    const hopIndex = parseNonNegInt(hopIndexStr);
    const logIndex = parseNonNegInt(logIndexStr);
    if (hopIndex === null || logIndex === null) return null;

    const ent = new BrokerSwapHopEntity();
    ent.id = id;
    ent.transactionHash = tx;
    ent.hopIndex = hopIndex;
    ent.logIndex = logIndex;
    ent.sender = sender;
    ent.recipient = recipient;
    ent.tokenIn = tokenIn;
    ent.tokenOut = tokenOut;
    ent.isCL = p.isCL;
    ent.stable = p.stable;
    ent.amountIn = amountIn;
    ent.amountOut = amountOut;
    ent.feeAmount = feeAmount;
    ent.feeToken = feeToken;
    ent.blockNumber = blockNumber;
    ent.blockTimestamp = blockTimestamp;
    return ent;
  }
}
