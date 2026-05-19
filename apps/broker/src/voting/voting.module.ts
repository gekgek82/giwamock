import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexerIngestedEventEntity } from '../models/indexer-ingested-event.entity';
import { VoterRewardClaimEntity } from '../models/voting/voter-reward-claim.entity';
import { VoterVoteEventEntity } from '../models/voting/voter-vote-event.entity';
import { VoterVotePositionEntity } from '../models/voting/voter-vote-position.entity';
import { VotingClaimableService } from './voting-claimable.service';
import { VotingController } from './voting.controller';
import { VotingService } from './voting.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VoterVotePositionEntity,
      VoterVoteEventEntity,
      VoterRewardClaimEntity,
      IndexerIngestedEventEntity,
    ]),
  ],
  controllers: [VotingController],
  providers: [VotingService, VotingClaimableService],
  exports: [VotingService, VotingClaimableService],
})
export class VotingModule {}
