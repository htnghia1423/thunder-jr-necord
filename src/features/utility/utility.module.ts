// src/features/utility/utility.module.ts
import { Module } from '@nestjs/common';

import { PingCommand } from '@/features/utility/commands/ping.command';

@Module({
	providers: [PingCommand],
})
export class UtilityModule {}
