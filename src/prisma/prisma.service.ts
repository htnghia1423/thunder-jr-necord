import {
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, PoolConfig } from 'pg';

import { PrismaClient } from '@/generated/prisma/client';

@Injectable()
export class PrismaService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	private readonly logger = new Logger(PrismaService.name);

	constructor() {
		const poolConfig: PoolConfig = {
			connectionString: process.env.DATABASE_URL,
		};

		/**
		 * The following lines are suppressed because external library types
		 * for 'pg' and '@prisma/adapter-pg' are not resolving correctly
		 * in the strict linting environment.
		 */

		const pool = new Pool(poolConfig);

		const adapter = new PrismaPg(pool);

		super({ adapter });
	}

	async onModuleInit(): Promise<void> {
		try {
			await this.$connect();
			this.logger.log(
				'🚀 Successfully connected to the database via Prisma v7 Adapter',
			);
		} catch (error: unknown) {
			this.logger.error('❌ Failed to initialize Prisma Client', error);
			throw error;
		}
	}

	async onModuleDestroy(): Promise<void> {
		try {
			await this.$disconnect();
			this.logger.log('🔌 Safely disconnected from the database');
		} catch (error: unknown) {
			this.logger.error('⚠️ Failed to disconnect from the database', error);
		}
	}

	/**
	 * Cleans all data from the database (useful for testing)
	 */
	async cleanDatabase(): Promise<unknown[]> {
		if (process.env.NODE_ENV === 'production') {
			throw new Error('Deleting the database in production is not allowed!');
		}

		const models = Reflect.ownKeys(this).filter(
			(key) =>
				typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$'),
		) as string[] as Array<keyof this>;

		return Promise.all(
			models.map((modelKey): Promise<unknown> => {
				const model = this[modelKey] as
					{ deleteMany: () => Promise<unknown> } | undefined;

				if (model && typeof model.deleteMany === 'function') {
					return model.deleteMany();
				}
				return Promise.resolve();
			}),
		);
	}
}
