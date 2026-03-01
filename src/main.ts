import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	await app.listen(process.env.PORT ?? 3000);
}

// Top-level await is not supported in CommonJS modules natively.
void bootstrap(); // NOSONAR
