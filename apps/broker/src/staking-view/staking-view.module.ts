import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexerIngestedEventEntity } from '../models/indexer-ingested-event.entity';
import { StakingViewController } from './staking-view.controller';
import { StakingViewService } from './staking-view.service';

@Module({
  imports: [TypeOrmModule.forFeature([IndexerIngestedEventEntity])],
  controllers: [StakingViewController],
  providers: [StakingViewService],
})
export class StakingViewModule {}
