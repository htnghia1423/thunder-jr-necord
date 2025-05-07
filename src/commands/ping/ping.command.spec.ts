import { Test, TestingModule } from '@nestjs/testing';
import { PingCommand } from './ping.command';
import { CommandInteraction, MessageFlags } from 'discord.js';

describe('PingCommand', () => {
  let command: PingCommand;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PingCommand],
    }).compile();

    command = module.get<PingCommand>(PingCommand);
  });

  it('should be defined', () => {
    expect(command).toBeDefined();
  });

  describe('onPing', () => {
    it('should respond with ping message', async () => {
      // Mocking CommandInteraction
      const mockInteraction = {
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
      } as unknown as CommandInteraction;

      // Mocking Date.now to return predictable values
      const originalDateNow = Date.now;
      Date.now = jest
        .fn()
        .mockReturnValueOnce(1000) // First call returns 1000
        .mockReturnValueOnce(1500); // Second call returns 1500

      try {
        await command.onPing([mockInteraction]);

        // Check if deferReply was called with correct params
        expect(mockInteraction.deferReply).toHaveBeenCalledWith({
          flags: MessageFlags.Ephemeral,
        });

        // Check if editReply was called with correct content
        expect(mockInteraction.editReply).toHaveBeenCalledWith({
          content: expect.stringContaining('500ms'),
        });
      } finally {
        // Restore original Date.now
        Date.now = originalDateNow;
      }
    });
  });
});
