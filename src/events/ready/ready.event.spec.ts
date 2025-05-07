import { Test, TestingModule } from '@nestjs/testing';
import { ReadyEvent } from './ready.event';
import { Client } from 'discord.js';
import { Logger } from '@nestjs/common';

describe('ReadyEvent', () => {
  let event: ReadyEvent;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReadyEvent],
    }).compile();

    event = module.get<ReadyEvent>(ReadyEvent);

    // Mock logger
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(event).toBeDefined();
  });

  describe('onReady', () => {
    it('should log ready message and set activity', async () => {
      // Create mock client
      const mockClient = {
        user: {
          tag: 'TestBot#1234',
          setActivity: jest.fn(),
        },
      } as unknown as Client<true>;

      // Call onReady with mock client
      await event.onReady([mockClient]);

      // Verify logger was called
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('TestBot#1234'));

      // Verify activity was set
      expect(mockClient.user.setActivity).toHaveBeenCalledWith({
        name: expect.any(String),
        type: 3, // WATCHING
      });
    });
  });
});
