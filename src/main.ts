import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { Logger } from '@nestjs/common';
import pkg from '../package.json';

export async function bootstrap() {
  const logger = new Logger('Bootstrap');

  logger.log(`Starting ${pkg.displayName} v${pkg.version}`);
  const app = await NestFactory.createApplicationContext(AppModule);

  app.enableShutdownHooks();
}

// Only run bootstrap when this file is executed directly
if (import.meta.path.includes('main.ts')) {
  bootstrap();
}
