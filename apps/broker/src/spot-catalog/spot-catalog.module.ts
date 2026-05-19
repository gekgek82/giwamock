import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpotGroupEntity } from '../models/group/spot-group.entity';
import { SpotGroupPairEntity } from '../models/pair/spot-group-pair.entity';
import { SpotPairAdminMetaEntity } from '../models/pair/spot-pair-admin-meta.entity';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';
import { SpotPairTimeBucketEntity } from '../models/pair/spot-pair-time-bucket.entity';
import { SpotGroupTokenEntity } from '../models/token/spot-group-token.entity';
import { SpotTokenEntity } from '../models/token/spot-token.entity';
import { SpotCatalogService } from './spot-catalog.service';
import { SpotGroupsService } from './spot-groups.service';
import { PoolAdminService } from './pool-admin.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SpotTokenEntity,
      SpotPairEntity,
      SpotPairAdminMetaEntity,
      SpotPairTimeBucketEntity,
      SpotGroupEntity,
      SpotGroupTokenEntity,
      SpotGroupPairEntity,
    ]),
  ],
  providers: [SpotCatalogService, SpotGroupsService, PoolAdminService],
  exports: [SpotCatalogService, SpotGroupsService, PoolAdminService],
})
export class SpotCatalogModule {}
