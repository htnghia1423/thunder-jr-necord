import {
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Global Prisma Service for database access
 * Implements NestJS lifecycle hooks for proper connection management
 */
@Injectable()
export class PrismaService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	private readonly logger = new Logger(PrismaService.name);

	/**
	 * Connect to database on module initialization
	 */
	async onModuleInit() {
		try {
			await this.$connect();
			this.logger.log('Successfully connected to database');
		} catch (error) {
			this.logger.error('Failed to connect to database', error);
			throw error;
		}
	}

	/**
	 * Disconnect from database on module destruction
	 */
	async onModuleDestroy() {
		try {
			await this.$disconnect();
			this.logger.log('Successfully disconnected from database');
		} catch (error) {
			this.logger.error('Failed to disconnect from database', error);
		}
	}

	/**
	 * Clean all data from database (useful for testing)
	 * WARNING: Only use in development/testing environments
	 */
	async cleanDatabase() {
		if (process.env.NODE_ENV === 'production') {
			throw new Error('Cannot clean database in production environment');
		}

		const models = Reflect.ownKeys(this).filter(
			(key) => typeof key === 'string' && key[0] !== '_' && key[0] !== '$',
		);

		return Promise.all(
			models.map((modelKey): Promise<unknown> => {
				const model = this[modelKey as keyof this];
				// Type guard to check if model has deleteMany method
				if (model && typeof model === 'object' && 'deleteMany' in model) {
					const deleteMany = model.deleteMany as () => Promise<unknown>;
					if (typeof deleteMany === 'function') {
						return deleteMany.call(model) as Promise<unknown>;
					}
				}
				return Promise.resolve();
			}),
		);
	}
}
