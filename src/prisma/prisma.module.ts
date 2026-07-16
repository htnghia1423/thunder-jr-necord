import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Global Prisma Module
 * Exports PrismaService for use across the entire application
 */
@Global()
@Module({
	providers: [PrismaService],
	exports: [PrismaService],
})
export class PrismaModule {}
