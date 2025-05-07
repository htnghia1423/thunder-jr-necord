import { Module } from '@nestjs/common';
import { CommandsModule } from './commands/commands.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [CommandsModule, EventsModule],
})
export class BotModule {}
