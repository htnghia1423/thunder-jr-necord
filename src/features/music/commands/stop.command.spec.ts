import { createMockInteraction } from '@test/helpers/discord';

import { StopCommand } from './stop.command';

describe('StopCommand', () => {
	function makeInteraction(overrides: Record<string, unknown> = {}): any {
		const interaction = createMockInteraction(overrides);
		interaction.isChatInputCommand = jest.fn().mockReturnValue(true);
		return interaction;
	}

	function createCommand() {
		const musicService = { stop: jest.fn() };
		const command = new StopCommand(musicService as any);
		return { command, musicService };
	}

	it('defers, delegates to MusicService.stop and edits the reply with the result message', async () => {
		const { command, musicService } = createCommand();
		musicService.stop.mockResolvedValue({
			success: true,
			message: '⏹️ Stopped playback and cleared the queue',
		});
		const interaction = makeInteraction();

		await command.execute([interaction] as any);

		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		expect(musicService.stop).toHaveBeenCalledTimes(1);
		expect(musicService.stop).toHaveBeenCalledWith(interaction);
		expect(interaction.editReply).toHaveBeenCalledWith({
			content: '⏹️ Stopped playback and cleared the queue',
		});
	});

	it('relays a failure message from the service verbatim', async () => {
		const { command, musicService } = createCommand();
		musicService.stop.mockResolvedValue({
			success: false,
			message: '❌ Nothing is playing',
		});
		const interaction = makeInteraction();

		await command.execute([interaction] as any);

		expect(interaction.editReply).toHaveBeenCalledWith({
			content: '❌ Nothing is playing',
		});
	});

	it('returns early without deferring or calling the service for non chat-input interactions', async () => {
		const { command, musicService } = createCommand();
		const interaction = makeInteraction();
		interaction.isChatInputCommand.mockReturnValue(false);

		await command.execute([interaction] as any);

		expect(interaction.deferReply).not.toHaveBeenCalled();
		expect(musicService.stop).not.toHaveBeenCalled();
		expect(interaction.editReply).not.toHaveBeenCalled();
	});

	it('propagates errors thrown by the service and does not edit the reply', async () => {
		const { command, musicService } = createCommand();
		musicService.stop.mockRejectedValue(new Error('stop failed'));
		const interaction = makeInteraction();

		await expect(command.execute([interaction] as any)).rejects.toThrow(
			'stop failed',
		);
		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		expect(interaction.editReply).not.toHaveBeenCalled();
	});
});
