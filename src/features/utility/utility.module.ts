// src/features/utility/utility.module.ts
import { Module } from '@nestjs/common';

import { HelpCommand } from '@/features/utility/commands/help.command';
import { PingCommand } from '@/features/utility/commands/ping.command';

@Module({
	providers: [HelpCommand, PingCommand],
})
export class UtilityModule {}
