import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpotAccountEntity } from '../models/account/spot-account.entity';
import { SpotAccountLiquidityProvisionEntity } from '../models/account/spot-account-liquidity-provision.entity';
import { SpotAccountNotificationEntity } from '../models/account/spot-account-notification.entity';
import { AccountNotificationService } from './account-notification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SpotAccountNotificationEntity,
      SpotAccountLiquidityProvisionEntity,
      SpotAccountEntity,
    ]),
  ],
  providers: [AccountNotificationService],
  exports: [AccountNotificationService],
})
export class AccountNotificationModule {}
