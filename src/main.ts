import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { Logger } from '@nestjs/common';
import pkg from '../package.json';

export async function bootstrap() {
  const logger = new Logger('Bootstrap');

  logger.log(`Starting ${pkg.displayName} v${pkg.version}`);
  const app = await NestFactory.createApplicationContext(AppModule);

  app.enableShutdownHooks();
  return app;
}

// This file is directly executed during normal operation, but imported in tests
// In tests, the bootstrap function will be called explicitly
if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}
