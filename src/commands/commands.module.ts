import { Module } from '@nestjs/common';
import { PingCommand } from './ping.command';

@Module({
  providers: [PingCommand],
})
export class CommandsModule {}
