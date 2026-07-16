import { LoopMode } from '../enums/loop.enum';
import { createMockInteraction } from '@test/helpers/discord';

import { LoopCommand } from './loop.command';

describe('LoopCommand', () => {
	function makeInteraction(overrides: Record<string, unknown> = {}): any {
		const interaction = createMockInteraction(overrides);
		interaction.isChatInputCommand = jest.fn().mockReturnValue(true);
		return interaction;
	}

	function createCommand() {
		const musicService = { setLoop: jest.fn() };
		const command = new LoopCommand(musicService as any);
		return { command, musicService };
	}

	it('maps the "song" mode to LoopMode.SONG and edits the reply with the result message', async () => {
		const { command, musicService } = createCommand();
		musicService.setLoop.mockResolvedValue({
			success: true,
			message: '🔂 Looping current song',
		});
		const interaction = makeInteraction();

		await command.execute([interaction] as any, { mode: 'song' } as any);

		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		expect(musicService.setLoop).toHaveBeenCalledWith(
			interaction,
			LoopMode.SONG,
		);
		expect(interaction.editReply).toHaveBeenCalledWith({
			content: '🔂 Looping current song',
		});
	});

	it('maps the "queue" mode to LoopMode.QUEUE', async () => {
		const { command, musicService } = createCommand();
		musicService.setLoop.mockResolvedValue({ success: true, message: 'ok' });
		const interaction = makeInteraction();

		await command.execute([interaction] as any, { mode: 'queue' } as any);

		expect(musicService.setLoop).toHaveBeenCalledWith(
			interaction,
			LoopMode.QUEUE,
		);
	});

	it('maps the "off" mode to LoopMode.OFF', async () => {
		const { command, musicService } = createCommand();
		musicService.setLoop.mockResolvedValue({ success: true, message: 'ok' });
		const interaction = makeInteraction();

		await command.execute([interaction] as any, { mode: 'off' } as any);

		expect(musicService.setLoop).toHaveBeenCalledWith(
			interaction,
			LoopMode.OFF,
		);
	});

	it('defaults an undefined mode to LoopMode.OFF', async () => {
		const { command, musicService } = createCommand();
		musicService.setLoop.mockResolvedValue({ success: true, message: 'ok' });
		const interaction = makeInteraction();

		await command.execute([interaction] as any, {});

		expect(musicService.setLoop).toHaveBeenCalledWith(
			interaction,
			LoopMode.OFF,
		);
	});

	it('returns early without deferring or calling the service for non chat-input interactions', async () => {
		const { command, musicService } = createCommand();
		const interaction = makeInteraction();
		interaction.isChatInputCommand.mockReturnValue(false);

		await command.execute([interaction] as any, { mode: 'song' } as any);

		expect(interaction.deferReply).not.toHaveBeenCalled();
		expect(musicService.setLoop).not.toHaveBeenCalled();
		expect(interaction.editReply).not.toHaveBeenCalled();
	});

	it('propagates errors thrown by the service and does not edit the reply', async () => {
		const { command, musicService } = createCommand();
		musicService.setLoop.mockRejectedValue(new Error('loop failed'));
		const interaction = makeInteraction();

		await expect(
			command.execute([interaction] as any, { mode: 'song' } as any),
		).rejects.toThrow('loop failed');
		expect(interaction.editReply).not.toHaveBeenCalled();
	});
});
