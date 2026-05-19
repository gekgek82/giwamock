import { Global, Module } from '@nestjs/common';
import { IndexerEventPersistenceService } from './indexer-event-persistence.service';
import { IndexerEventsService } from './indexer-events.service';
import { BrokerDbModule } from '../broker-db/broker-db.module';

@Global()
@Module({
  imports: [BrokerDbModule],
  providers: [IndexerEventsService, IndexerEventPersistenceService],
  exports: [IndexerEventsService, IndexerEventPersistenceService],
})
export class IndexerEventsModule {}

