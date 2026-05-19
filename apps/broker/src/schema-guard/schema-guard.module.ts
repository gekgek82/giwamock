import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchemaGuardService } from './schema-guard.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  providers: [SchemaGuardService],
})
export class SchemaGuardModule {}
