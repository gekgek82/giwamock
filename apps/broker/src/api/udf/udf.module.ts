// apps/broker/src/api/udf/udf.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpotPairEntity } from '../../models/pair/spot-pair.entity';
import { SpotPairTimeBucketEntity } from '../../models/pair/spot-pair-time-bucket.entity';
import { SpotTokenEntity } from '../../models/token/spot-token.entity';
import { SpotTokenTimeBucketEntity } from '../../models/token/spot-token-time-bucket.entity';
import { UdfController } from './udf.controller';
import { UdfService } from './udf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SpotPairEntity,
      SpotPairTimeBucketEntity,
      SpotTokenEntity,
      SpotTokenTimeBucketEntity,
    ]),
  ],
  controllers: [UdfController],
  providers: [UdfService],
  exports: [UdfService],
})
export class UdfModule {}
