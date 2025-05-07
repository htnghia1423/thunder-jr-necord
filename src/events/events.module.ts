import { Module } from '@nestjs/common';
import { ReadyEvent } from '@/events/ready';

@Module({
  providers: [ReadyEvent],
})
export class EventsModule {}
