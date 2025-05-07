import { Module } from '@nestjs/common';
import { PingCommand } from '@/commands/ping';

@Module({
  providers: [PingCommand],
})
export class CommandsModule {}
