import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import type { INestApplicationContext } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import * as mainModule from './main';
import { test, expect, mock } from 'bun:test';

test('Bootstrap should initialize app context and enable shutdown hooks', async () => {
  const mockAppContext = {
    enableShutdownHooks: mock(() => {}),
    select: mock(() => null),
    get: mock(() => null),
    resolve: mock(() => null),
    registerRequestByContextId: mock(() => null),
    init: mock(() => null),
    close: mock(() => null),
    useLogger: mock(() => null),
  } as unknown as INestApplicationContext;

  // Save original function
  const originalCreateApplicationContext = NestFactory.createApplicationContext;
  const originalLoggerLog = Logger.prototype.log;

  try {
    // Mock functions
    NestFactory.createApplicationContext = () => Promise.resolve(mockAppContext);
    Logger.prototype.log = mock(() => {});

    // Call bootstrap directly
    await (mainModule as any).bootstrap();

    // Check that enableShutdownHooks was called
    expect(mockAppContext.enableShutdownHooks).toHaveBeenCalled();
  } finally {
    // Restore original functions
    NestFactory.createApplicationContext = originalCreateApplicationContext;
    Logger.prototype.log = originalLoggerLog;
  }
});
