import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { WalletLpPositionDto, WalletLpPositionsResponseDto } from '@giwater/shared';
import { SpotAccountLiquidityProvisionEntity } from '../../models/account/spot-account-liquidity-provision.entity';
import { SpotPairEntity } from '../../models/pair/spot-pair.entity';

@Injectable()
export class SpotAccountLpService {
  constructor(
    @InjectRepository(SpotAccountLiquidityProvisionEntity)
    private readonly provisionRepo: Repository<SpotAccountLiquidityProvisionEntity>,
    @InjectRepository(SpotPairEntity)
    private readonly pairRepo: Repository<SpotPairEntity>,
  ) {}

  async getLpPositions(walletAddress: string): Promise<WalletLpPositionsResponseDto> {
    const wallet = walletAddress.trim().toLowerCase();

    // Aggregate per pool: sum amounts added, latest activity, detect CL
    // All references inside raw SQL expressions use DB column names (snake_case)
    const rows = await this.provisionRepo
      .createQueryBuilder('p')
      .select('p.pool_address', 'poolAddress')
      .addSelect('MIN(p.token0)', 'token0')
      .addSelect('MIN(p.token1)', 'token1')
      .addSelect('SUM(p.amount0::numeric)', 'totalAmount0')
      .addSelect('SUM(p.amount1::numeric)', 'totalAmount1')
      .addSelect('MAX(p.block_timestamp_sec)', 'lastActivityAt')
      .addSelect('MAX(p.cl_tick_spacing)', 'clTickSpacing')
      .addSelect('BOOL_OR(p.stable = true)', 'isStable')
      .addSelect("BOOL_OR(p.event_type = 'CLLiquidityAdded')", 'isCL')
      .where('p.account_id = :wallet', { wallet })
      .groupBy('p.pool_address')
      .getRawMany<{
        poolAddress: string;
        token0: string;
        token1: string;
        totalAmount0: string;
        totalAmount1: string;
        lastActivityAt: string;
        clTickSpacing: string | null;
        isStable: boolean | null;
        isCL: boolean;
      }>();

    if (rows.length === 0) return { positions: [], total: 0 };

    const poolAddresses = rows.map((r) => r.poolAddress);
    const pairs = await this.pairRepo.find({ where: { id: In(poolAddresses) } });
    const pairMap = new Map(pairs.map((p) => [p.id, p]));

    const positions: WalletLpPositionDto[] = rows.map((row) => {
      const pair = pairMap.get(row.poolAddress);
      const token0Addr = (row.token0 ?? '').toLowerCase();
      const token1Addr = (row.token1 ?? '').toLowerCase();

      let token0Symbol = '';
      let token0Decimals = 18;
      let token1Symbol = '';
      let token1Decimals = 18;

      if (pair) {
        const baseAddr = pair.base.toLowerCase();
        if (token0Addr === baseAddr) {
          token0Symbol = pair.baseSymbol;
          token0Decimals = pair.bDecimal;
          token1Symbol = pair.quoteSymbol;
          token1Decimals = pair.qDecimal;
        } else {
          token0Symbol = pair.quoteSymbol;
          token0Decimals = pair.qDecimal;
          token1Symbol = pair.baseSymbol;
          token1Decimals = pair.bDecimal;
        }
      }

      return {
        poolAddress: row.poolAddress,
        token0: { address: token0Addr, symbol: token0Symbol, decimals: token0Decimals },
        token1: { address: token1Addr, symbol: token1Symbol, decimals: token1Decimals },
        poolType: row.isCL ? 'CL' : 'BASIC',
        tickSpacing: row.clTickSpacing != null ? Number(row.clTickSpacing) : null,
        isStable: row.isStable ?? null,
        effectiveFeeBps: pair?.effectiveFeeBps ?? null,
        totalAmount0Added: row.totalAmount0 ?? '0',
        totalAmount1Added: row.totalAmount1 ?? '0',
        poolBaseLiquidity: pair?.baseLiquidity ?? 0,
        poolQuoteLiquidity: pair?.quoteLiquidity ?? 0,
        lastActivityAt: Number(row.lastActivityAt) || 0,
      };
    });

    positions.sort((a, b) => b.lastActivityAt - a.lastActivityAt);

    return { positions, total: positions.length };
  }
}
