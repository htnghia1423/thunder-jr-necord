import { createMockInteraction } from '@test/helpers/discord';

import { SkipCommand } from './skip.command';

describe('SkipCommand', () => {
	function makeInteraction(overrides: Record<string, unknown> = {}): any {
		const interaction = createMockInteraction(overrides);
		interaction.isChatInputCommand = jest.fn().mockReturnValue(true);
		return interaction;
	}

	function createCommand() {
		const musicService = { skip: jest.fn() };
		const command = new SkipCommand(musicService as any);
		return { command, musicService };
	}

	it('defers, delegates to MusicService.skip and edits the reply with the result message', async () => {
		const { command, musicService } = createCommand();
		musicService.skip.mockResolvedValue({
			success: true,
			message: '⏭️ Skipped the current song',
		});
		const interaction = makeInteraction();

		await command.execute([interaction] as any);

		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		expect(musicService.skip).toHaveBeenCalledTimes(1);
		expect(musicService.skip).toHaveBeenCalledWith(interaction);
		expect(interaction.editReply).toHaveBeenCalledWith({
			content: '⏭️ Skipped the current song',
		});
	});

	it('defers before invoking the service so Discord does not time out', async () => {
		const { command, musicService } = createCommand();
		musicService.skip.mockResolvedValue({ success: true, message: 'ok' });
		const interaction = makeInteraction();

		await command.execute([interaction] as any);

		expect(interaction.deferReply.mock.invocationCallOrder[0]).toBeLessThan(
			musicService.skip.mock.invocationCallOrder[0],
		);
	});

	it('relays a failure message from the service verbatim', async () => {
		const { command, musicService } = createCommand();
		musicService.skip.mockResolvedValue({
			success: false,
			message: '❌ No music is currently playing',
		});
		const interaction = makeInteraction();

		await command.execute([interaction] as any);

		expect(interaction.editReply).toHaveBeenCalledWith({
			content: '❌ No music is currently playing',
		});
	});

	it('returns early without deferring or calling the service for non chat-input interactions', async () => {
		const { command, musicService } = createCommand();
		const interaction = makeInteraction();
		interaction.isChatInputCommand.mockReturnValue(false);

		await command.execute([interaction] as any);

		expect(interaction.deferReply).not.toHaveBeenCalled();
		expect(musicService.skip).not.toHaveBeenCalled();
		expect(interaction.editReply).not.toHaveBeenCalled();
	});

	it('propagates errors thrown by the service and does not edit the reply', async () => {
		const { command, musicService } = createCommand();
		musicService.skip.mockRejectedValue(new Error('distube boom'));
		const interaction = makeInteraction();

		await expect(command.execute([interaction] as any)).rejects.toThrow(
			'distube boom',
		);
		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		expect(interaction.editReply).not.toHaveBeenCalled();
	});
});
