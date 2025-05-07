import { Module } from '@nestjs/common';
import { ReadyEvent } from './ready.event';

@Module({
  providers: [ReadyEvent],
})
export class EventsModule {}
