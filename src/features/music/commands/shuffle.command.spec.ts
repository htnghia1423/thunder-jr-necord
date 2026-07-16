import { createMockInteraction } from '@test/helpers/discord';

import { ShuffleCommand } from './shuffle.command';

describe('ShuffleCommand', () => {
	function makeInteraction(overrides: Record<string, unknown> = {}): any {
		const interaction = createMockInteraction(overrides);
		interaction.isChatInputCommand = jest.fn().mockReturnValue(true);
		return interaction;
	}

	function createCommand() {
		const musicService = { shuffle: jest.fn() };
		const command = new ShuffleCommand(musicService as any);
		return { command, musicService };
	}

	it('defers, delegates to MusicService.shuffle and edits the reply with the result message', async () => {
		const { command, musicService } = createCommand();
		musicService.shuffle.mockResolvedValue({
			success: true,
			message: '🔀 Shuffled the queue',
		});
		const interaction = makeInteraction();

		await command.execute([interaction] as any);

		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		expect(musicService.shuffle).toHaveBeenCalledTimes(1);
		expect(musicService.shuffle).toHaveBeenCalledWith(interaction);
		expect(interaction.editReply).toHaveBeenCalledWith({
			content: '🔀 Shuffled the queue',
		});
	});

	it('relays a failure message from the service verbatim', async () => {
		const { command, musicService } = createCommand();
		musicService.shuffle.mockResolvedValue({
			success: false,
			message: '❌ Not enough songs in the queue to shuffle',
		});
		const interaction = makeInteraction();

		await command.execute([interaction] as any);

		expect(interaction.editReply).toHaveBeenCalledWith({
			content: '❌ Not enough songs in the queue to shuffle',
		});
	});

	it('returns early without deferring or calling the service for non chat-input interactions', async () => {
		const { command, musicService } = createCommand();
		const interaction = makeInteraction();
		interaction.isChatInputCommand.mockReturnValue(false);

		await command.execute([interaction] as any);

		expect(interaction.deferReply).not.toHaveBeenCalled();
		expect(musicService.shuffle).not.toHaveBeenCalled();
		expect(interaction.editReply).not.toHaveBeenCalled();
	});

	it('propagates errors thrown by the service and does not edit the reply', async () => {
		const { command, musicService } = createCommand();
		musicService.shuffle.mockRejectedValue(new Error('shuffle failed'));
		const interaction = makeInteraction();

		await expect(command.execute([interaction] as any)).rejects.toThrow(
			'shuffle failed',
		);
		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		expect(interaction.editReply).not.toHaveBeenCalled();
	});
});
