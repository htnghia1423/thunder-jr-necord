import { createMockInteraction } from '@test/helpers/discord';

import { RemoveCommand } from './remove.command';

describe('RemoveCommand', () => {
	function createCommand() {
		const musicService = { removeSong: jest.fn() };
		const command = new RemoveCommand(musicService as any);
		return { command, musicService };
	}

	it('rejects a request with neither position nor song name without calling the service', async () => {
		const { command, musicService } = createCommand();
		const interaction = createMockInteraction();

		await command.execute([interaction] as any, {} as any);

		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		expect(musicService.removeSong).not.toHaveBeenCalled();
		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.content).toContain(
			'Please provide either position or song name',
		);
	});

	it('removes by position and reports the removed song with a "by position" label', async () => {
		const { command, musicService } = createCommand();
		musicService.removeSong.mockResolvedValue({
			success: true,
			message: 'removed',
			data: {
				songName: 'Never Gonna Give You Up',
				position: 3,
				method: 'position',
			},
		});
		const interaction = createMockInteraction({ userId: 'user-42' });

		await command.execute([interaction] as any, { position: 3 } as any);

		expect(musicService.removeSong).toHaveBeenCalledWith(interaction, {
			position: 3,
		});
		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.content).toContain('by position');
		expect(payload.content).toContain('Never Gonna Give You Up');
		expect(payload.content).toContain('position #3');
		expect(payload.content).toContain('<@user-42>');
	});

	it('removes by name and reports the removed song with a "by name" label', async () => {
		const { command, musicService } = createCommand();
		musicService.removeSong.mockResolvedValue({
			success: true,
			message: 'removed',
			data: { songName: 'Bohemian Rhapsody', position: 5, method: 'name' },
		});
		const interaction = createMockInteraction();

		await command.execute(
			[interaction] as any,
			{ songName: 'bohemian' } as any,
		);

		expect(musicService.removeSong).toHaveBeenCalledWith(interaction, {
			songName: 'bohemian',
		});
		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.content).toContain('by name');
		expect(payload.content).toContain('Bohemian Rhapsody');
		expect(payload.content).toContain('position #5');
	});

	it('surfaces the service failure message when removal is unsuccessful', async () => {
		const { command, musicService } = createCommand();
		musicService.removeSong.mockResolvedValue({
			success: false,
			message: 'Position 99 is out of range',
		});
		const interaction = createMockInteraction();

		await command.execute([interaction] as any, { position: 99 } as any);

		expect(interaction.editReply).toHaveBeenCalledWith({
			content: '❌ **Position 99 is out of range**',
		});
	});

	it('propagates errors thrown by the service', async () => {
		const { command, musicService } = createCommand();
		musicService.removeSong.mockRejectedValue(new Error('remove failed'));
		const interaction = createMockInteraction();

		await expect(
			command.execute([interaction] as any, { position: 1 } as any),
		).rejects.toThrow('remove failed');
		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
	});
});
