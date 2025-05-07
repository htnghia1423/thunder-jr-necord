import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { Logger } from '@nestjs/common';
import pkg from '../package.json';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  logger.log(`Starting ${pkg.displayName} v${pkg.version}`);
  const app = await NestFactory.createApplicationContext(AppModule);

  app.enableShutdownHooks();
}

bootstrap();
