import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('token_faucets')
export class TokenFaucetEntity {
  @PrimaryColumn({ name: 'faucet_address', type: 'varchar', length: 42 })
  faucetAddress: string;

  @Column({ name: 'token_address', type: 'varchar', length: 42 })
  tokenAddress: string;

  @Column({ name: 'token_name', type: 'varchar', length: 100 })
  tokenName: string;

  @Column({ name: 'token_symbol', type: 'varchar', length: 20 })
  tokenSymbol: string;

  @Column({ name: 'token_decimals', type: 'integer', default: 18 })
  tokenDecimals: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
