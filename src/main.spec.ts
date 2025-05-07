import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import type { INestApplicationContext } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import * as mainModule from './main';

describe('Bootstrap', () => {
  let mockAppContext: INestApplicationContext;
  let originalCreateApplicationContext: typeof NestFactory.createApplicationContext;
  let originalLoggerLog: typeof Logger.prototype.log;

  beforeEach(() => {
    // Create mock app context
    mockAppContext = {
      enableShutdownHooks: jest.fn(),
      select: jest.fn(),
      get: jest.fn(),
      resolve: jest.fn(),
      registerRequestByContextId: jest.fn(),
      init: jest.fn(),
      close: jest.fn(),
      useLogger: jest.fn(),
    } as unknown as INestApplicationContext;

    // Save original functions
    originalCreateApplicationContext = NestFactory.createApplicationContext;
    originalLoggerLog = Logger.prototype.log;

    // Mock functions
    NestFactory.createApplicationContext = jest.fn().mockResolvedValue(mockAppContext);
    Logger.prototype.log = jest.fn();
  });

  afterEach(() => {
    // Restore original functions
    NestFactory.createApplicationContext = originalCreateApplicationContext;
    Logger.prototype.log = originalLoggerLog;
  });

  it('should initialize app context and enable shutdown hooks', async () => {
    // Call bootstrap directly
    const app = await mainModule.bootstrap();

    // Check that enableShutdownHooks was called
    expect(mockAppContext.enableShutdownHooks).toHaveBeenCalled();
    expect(app).toBe(mockAppContext);
  });
});
