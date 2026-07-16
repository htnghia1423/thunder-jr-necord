import { createMockInteraction } from '@test/helpers/discord';

import { VolumeCommand } from './volume.command';

describe('VolumeCommand', () => {
	function makeInteraction(overrides: Record<string, unknown> = {}): any {
		const interaction = createMockInteraction(overrides);
		interaction.isChatInputCommand = jest.fn().mockReturnValue(true);
		return interaction;
	}

	function createCommand() {
		const musicService = { setVolume: jest.fn() };
		const command = new VolumeCommand(musicService as any);
		return { command, musicService };
	}

	it('defers, forwards the requested level to MusicService.setVolume and edits the reply', async () => {
		const { command, musicService } = createCommand();
		musicService.setVolume.mockResolvedValue({
			success: true,
			message: '🔊 Volume set to 75%',
		});
		const interaction = makeInteraction();

		await command.execute([interaction] as any, { level: 75 });

		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		expect(musicService.setVolume).toHaveBeenCalledTimes(1);
		expect(musicService.setVolume).toHaveBeenCalledWith(interaction, 75);
		expect(interaction.editReply).toHaveBeenCalledWith({
			content: '🔊 Volume set to 75%',
		});
	});

	it('passes the exact level value through, including boundary values', async () => {
		const { command, musicService } = createCommand();
		musicService.setVolume.mockResolvedValue({ success: true, message: 'ok' });
		const interaction = makeInteraction();

		await command.execute([interaction] as any, { level: 1 });

		expect(musicService.setVolume).toHaveBeenCalledWith(interaction, 1);
	});

	it('relays a failure message from the service verbatim', async () => {
		const { command, musicService } = createCommand();
		musicService.setVolume.mockResolvedValue({
			success: false,
			message: '❌ You must be in a voice channel',
		});
		const interaction = makeInteraction();

		await command.execute([interaction] as any, { level: 50 });

		expect(interaction.editReply).toHaveBeenCalledWith({
			content: '❌ You must be in a voice channel',
		});
	});

	it('returns early without deferring or calling the service for non chat-input interactions', async () => {
		const { command, musicService } = createCommand();
		const interaction = makeInteraction();
		interaction.isChatInputCommand.mockReturnValue(false);

		await command.execute([interaction] as any, { level: 50 });

		expect(interaction.deferReply).not.toHaveBeenCalled();
		expect(musicService.setVolume).not.toHaveBeenCalled();
		expect(interaction.editReply).not.toHaveBeenCalled();
	});

	it('propagates errors thrown by the service and does not edit the reply', async () => {
		const { command, musicService } = createCommand();
		musicService.setVolume.mockRejectedValue(new Error('volume failed'));
		const interaction = makeInteraction();

		await expect(
			command.execute([interaction] as any, { level: 50 } as any),
		).rejects.toThrow('volume failed');
		expect(interaction.editReply).not.toHaveBeenCalled();
	});
});
