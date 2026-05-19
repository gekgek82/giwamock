import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VeLockEventEntity } from '../models/ve-lock/ve-lock-event.entity';
import { VeLockPositionEntity } from '../models/ve-lock/ve-lock-position.entity';
import { VeLockController } from './ve-lock.controller';
import { VeLockService } from './ve-lock.service';

@Module({
  imports: [TypeOrmModule.forFeature([VeLockPositionEntity, VeLockEventEntity])],
  controllers: [VeLockController],
  providers: [VeLockService],
  exports: [VeLockService],
})
export class VeLockModule {}
