import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { aggregateIndexedEvent } from '../aggregator/index';
import { DynamicSwapFeeReadModelService } from '../dynamic-fee/dynamic-swap-fee-read-model.service';
import { BrokerSwapHopMaterializationService } from '../swap-hop/broker-swap-hop-materialization.service';
import { SwapLiquidityGraphService } from '../swap-liquidity/swap-liquidity-graph.service';
import { SwapOhlcvAggregationService } from '../swap-ohlcv/swap-ohlcv-aggregation.service';

function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

@Injectable()
export class IndexerAggregationService {
  private readonly logger = new Logger(IndexerAggregationService.name);

  constructor(
    private readonly swapGraph: SwapLiquidityGraphService,
    private readonly swapOhlcv: SwapOhlcvAggregationService,
    private readonly dynamicSwapFeeReadModel: DynamicSwapFeeReadModelService,
    private readonly brokerSwapHopMaterialization: BrokerSwapHopMaterializationService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async aggregatePayload(payload: unknown): Promise<{ swapPool: string | null }> {
    const record =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)
        : {};
    const id = typeof record.id === 'string' ? record.id : '(no id)';
    const type = typeof record.type === 'string' ? record.type : '(no type)';
    try {
      const { swapPool } = await aggregateIndexedEvent(payload, {
        swapGraph: this.swapGraph,
        swapOhlcv: this.swapOhlcv,
        dynamicSwapFeeReadModel: this.dynamicSwapFeeReadModel,
        dataSource: this.dataSource,
      });
      if (type === 'Swap') {
        try {
          await this.brokerSwapHopMaterialization.upsertFromSwapPayload(payload);
        } catch (matErr) {
          this.logger.error(
            `swap_hops materialization failed (type=Swap id=${id}): ${
              matErr instanceof Error ? matErr.message : String(matErr)
            }`,
          );
        }
      }
      this.logger.log(`Indexer aggregation OK type=${type} id=${id}`);
      return { swapPool: swapPool ?? null };
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        this.logger.warn(
          `Indexer aggregation skipped duplicate row write (idempotent replay): ${err instanceof Error ? err.message : err}`,
        );
        return { swapPool: null };
      }
      this.logger.error(
        `Indexer aggregation failed: ${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }
  }
}
