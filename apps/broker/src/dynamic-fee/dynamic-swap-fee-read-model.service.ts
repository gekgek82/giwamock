import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  CLFactoryDefaultUnstakedFeeChangedIndexerBrokerPayload,
  CLFactorySwapFeeModuleChangedIndexerBrokerPayload,
  ClDynamicFeeReadModelDto,
  DynamicSwapFeeModuleCustomFeeSetIndexerBrokerPayload,
  DynamicSwapFeeModuleDefaultFeeCapSetIndexerBrokerPayload,
  DynamicSwapFeeModuleDefaultScalingFactorSetIndexerBrokerPayload,
  DynamicSwapFeeModuleDiscountedDeregisteredIndexerBrokerPayload,
  DynamicSwapFeeModuleDiscountedRegisteredIndexerBrokerPayload,
  DynamicSwapFeeModuleDynamicFeeResetIndexerBrokerPayload,
  DynamicSwapFeeModuleFeeCapSetIndexerBrokerPayload,
  DynamicSwapFeeModuleScalingFactorSetIndexerBrokerPayload,
  DynamicSwapFeeModuleSecondsAgoSetIndexerBrokerPayload,
} from '@giwater/shared';
import { Repository } from 'typeorm';
import {
  BROKER_DYNAMIC_SWAP_FEE_GLOBAL_ROW_ID,
  BrokerDynamicSwapFeeGlobalEntity,
} from '../models/dynamic-fee/broker-dynamic-swap-fee-global.entity';
import { BrokerDynamicSwapFeeDiscountEntity } from '../models/dynamic-fee/broker-dynamic-swap-fee-discount.entity';
import { BrokerDynamicSwapFeePoolEntity } from '../models/dynamic-fee/broker-dynamic-swap-fee-pool.entity';
import { parseWireBigInt } from '../swap-ohlcv/bigint-for-ui';

function lc(addr: string): string {
  return addr.trim().toLowerCase();
}

/** Same UI convention as pool fees: wire integer → basis points (÷100). */
function feeWireToBps(feeWire: string): number {
  const v = parseWireBigInt(feeWire);
  return Number(v / 100n);
}

@Injectable()
export class DynamicSwapFeeReadModelService {
  constructor(
    @InjectRepository(BrokerDynamicSwapFeeGlobalEntity)
    private readonly globalRepo: Repository<BrokerDynamicSwapFeeGlobalEntity>,
    @InjectRepository(BrokerDynamicSwapFeePoolEntity)
    private readonly poolRepo: Repository<BrokerDynamicSwapFeePoolEntity>,
    @InjectRepository(BrokerDynamicSwapFeeDiscountEntity)
    private readonly discountRepo: Repository<BrokerDynamicSwapFeeDiscountEntity>,
  ) {}

  async onDefaultFeeCapSet(
    payload: DynamicSwapFeeModuleDefaultFeeCapSetIndexerBrokerPayload,
  ): Promise<void> {
    await this.upsertGlobal({
      defaultFeeCapWire: String(payload.defaultFeeCap),
    });
  }

  async onDefaultScalingFactorSet(
    payload: DynamicSwapFeeModuleDefaultScalingFactorSetIndexerBrokerPayload,
  ): Promise<void> {
    await this.upsertGlobal({
      defaultScalingFactorWire: String(payload.defaultScalingFactor),
    });
  }

  async onSecondsAgoSet(
    payload: DynamicSwapFeeModuleSecondsAgoSetIndexerBrokerPayload,
  ): Promise<void> {
    await this.upsertGlobal({
      secondsAgoWire: String(payload.secondsAgo),
    });
  }

  async onFeeCapSet(
    payload: DynamicSwapFeeModuleFeeCapSetIndexerBrokerPayload,
  ): Promise<void> {
    const poolId = lc(payload.pool);
    await this.upsertPool(poolId, { feeCapWire: String(payload.feeCap) });
  }

  async onScalingFactorSet(
    payload: DynamicSwapFeeModuleScalingFactorSetIndexerBrokerPayload,
  ): Promise<void> {
    const poolId = lc(payload.pool);
    await this.upsertPool(poolId, {
      scalingFactorWire: String(payload.scalingFactor),
    });
  }

  async onCustomFeeSet(
    payload: DynamicSwapFeeModuleCustomFeeSetIndexerBrokerPayload,
  ): Promise<void> {
    const poolId = lc(payload.pool);
    await this.upsertPool(poolId, {
      baseFeeWire: String(payload.fee),
    });
  }

  /**
   * On-chain reset clears pool `feeCap` and `scalingFactor` only (not custom base fee).
   */
  async onDynamicFeeReset(
    payload: DynamicSwapFeeModuleDynamicFeeResetIndexerBrokerPayload,
  ): Promise<void> {
    const poolId = lc(payload.pool);
    await this.upsertPool(poolId, {
      feeCapWire: null,
      scalingFactorWire: null,
    });
  }

  async onDiscountedRegistered(
    payload: DynamicSwapFeeModuleDiscountedRegisteredIndexerBrokerPayload,
  ): Promise<void> {
    const address = lc(payload.discountReceiver);
    await this.discountRepo.upsert(
      {
        address,
        discountWire: String(payload.discount),
      },
      ['address'],
    );
  }

  async onCLFactoryDefaultUnstakedFeeChanged(
    payload: CLFactoryDefaultUnstakedFeeChangedIndexerBrokerPayload,
  ): Promise<void> {
    await this.upsertGlobal({ defaultUnstakedFeeWire: String(payload.newUnstakedFee) });
  }

  async onCLFactorySwapFeeModuleChanged(
    payload: CLFactorySwapFeeModuleChangedIndexerBrokerPayload,
  ): Promise<void> {
    await this.upsertGlobal({ swapFeeModule: payload.newFeeModule });
  }

  async onDiscountedDeregistered(
    payload: DynamicSwapFeeModuleDiscountedDeregisteredIndexerBrokerPayload,
  ): Promise<void> {
    const address = lc(payload.discountOver);
    await this.discountRepo.delete({ address });
  }

  /**
   * Aggregated CL dynamic-fee state: global defaults, per-pool curve wires, optional per-sender discount.
   * Instantaneous `getFee(pool)` at a block still requires an RPC read (TWAP + slot0).
   */
  async getClReadModel(
    poolIdRaw: string,
    senderRaw?: string,
  ): Promise<ClDynamicFeeReadModelDto> {
    const poolId = lc(poolIdRaw);
    const [globalRow, poolRow, discountRow] = await Promise.all([
      this.globalRepo.findOne({
        where: { id: BROKER_DYNAMIC_SWAP_FEE_GLOBAL_ROW_ID },
      }),
      this.poolRepo.findOne({ where: { poolId } }),
      senderRaw
        ? this.discountRepo.findOne({ where: { address: lc(senderRaw) } })
        : Promise.resolve(null),
    ]);

    const discountWire = discountRow?.discountWire ?? null;
    return {
      poolId,
      globals: {
        defaultFeeCapWire: globalRow?.defaultFeeCapWire ?? null,
        defaultScalingFactorWire: globalRow?.defaultScalingFactorWire ?? null,
        secondsAgoWire: globalRow?.secondsAgoWire ?? null,
        defaultUnstakedFeeWire: globalRow?.defaultUnstakedFeeWire ?? null,
        swapFeeModule: globalRow?.swapFeeModule ?? null,
      },
      curve: {
        poolId,
        baseFeeWire: poolRow?.baseFeeWire ?? null,
        feeCapWire: poolRow?.feeCapWire ?? null,
        scalingFactorWire: poolRow?.scalingFactorWire ?? null,
      },
      sender:
        senderRaw && senderRaw.trim()
          ? {
              address: lc(senderRaw),
              discountWire,
              discountBps:
                discountWire !== null ? feeWireToBps(discountWire) : null,
            }
          : null,
    };
  }

  private async upsertGlobal(
    patch: Partial<
      Pick<
        BrokerDynamicSwapFeeGlobalEntity,
        | 'defaultFeeCapWire'
        | 'defaultScalingFactorWire'
        | 'secondsAgoWire'
        | 'defaultUnstakedFeeWire'
        | 'swapFeeModule'
      >
    >,
  ): Promise<void> {
    await this.globalRepo.upsert(
      {
        id: BROKER_DYNAMIC_SWAP_FEE_GLOBAL_ROW_ID,
        ...patch,
      },
      ['id'],
    );
  }

  private async upsertPool(
    poolId: string,
    patch: Partial<
      Pick<
        BrokerDynamicSwapFeePoolEntity,
        'baseFeeWire' | 'feeCapWire' | 'scalingFactorWire'
      >
    >,
  ): Promise<void> {
    await this.poolRepo.upsert(
      {
        poolId,
        ...patch,
      },
      ['poolId'],
    );
  }
}
