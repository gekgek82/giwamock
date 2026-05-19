import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenFaucetEntity } from '../../models/faucet/token-faucet.entity.js';
import type { AdminFaucetInfo, FaucetListResponse, RegisterFaucetRequest } from '@giwater/shared';

@Injectable()
export class TokenFaucetsService {
  constructor(
    @InjectRepository(TokenFaucetEntity)
    private readonly faucetRepo: Repository<TokenFaucetEntity>,
  ) {}

  async findAll(): Promise<FaucetListResponse> {
    const faucets = await this.faucetRepo.find({ order: { createdAt: 'DESC' } });
    return { faucets: faucets.map((f) => this.toDto(f)), total: faucets.length };
  }

  async register(dto: RegisterFaucetRequest): Promise<AdminFaucetInfo> {
    const normalized = dto.faucetAddress.toLowerCase();
    const existing = await this.faucetRepo.findOne({ where: { faucetAddress: normalized } });
    if (existing) throw new ConflictException(`Faucet ${normalized} is already registered`);
    const saved = await this.faucetRepo.save(
      this.faucetRepo.create({
        faucetAddress: normalized,
        tokenAddress: dto.tokenAddress.toLowerCase(),
        tokenName: dto.tokenName,
        tokenSymbol: dto.tokenSymbol,
        tokenDecimals: dto.tokenDecimals,
      }),
    );
    return this.toDto(saved);
  }

  async remove(faucetAddress: string): Promise<void> {
    const normalized = faucetAddress.toLowerCase();
    const result = await this.faucetRepo.delete({ faucetAddress: normalized });
    if (result.affected === 0) throw new NotFoundException(`Faucet ${normalized} not found`);
  }

  private toDto(f: TokenFaucetEntity): AdminFaucetInfo {
    return {
      faucetAddress: f.faucetAddress,
      tokenAddress: f.tokenAddress,
      tokenName: f.tokenName,
      tokenSymbol: f.tokenSymbol,
      tokenDecimals: f.tokenDecimals,
      createdAt: f.createdAt.toISOString(),
    };
  }
}
