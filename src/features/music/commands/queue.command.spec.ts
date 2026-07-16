import { createMockInteraction } from '@test/helpers/discord';
import { ComponentType } from 'discord.js';

import { QueueCommand } from './queue.command';

jest.mock('../services/music.service', () => ({
	MusicService: class {},
}));

const makeInteraction = (options: Record<string, unknown> = {}): any => {
	const interaction = createMockInteraction(options);
	interaction.isChatInputCommand = jest.fn().mockReturnValue(true);
	return interaction;
};

const buildSong = (overrides: Record<string, unknown> = {}): any => ({
	name: 'Test Song',
	url: 'https://youtu.be/test',
	formattedDuration: '03:14',
	duration: 194,
	...overrides,
});

const buildQueue = (songs: any[]): any => ({
	songs,
	formattedDuration: '42:00',
	repeatMode: 0,
	volume: 100,
});

describe('QueueCommand', () => {
	let musicService: any;
	let command: QueueCommand;

	beforeEach(() => {
		musicService = { validateGuildAndGetQueue: jest.fn() };
		command = new QueueCommand(musicService as any);
	});

	it('replies with an error embed when there is no queue', async () => {
		const interaction = makeInteraction();
		musicService.validateGuildAndGetQueue.mockReturnValue({
			success: false,
			message: 'No music queue found',
		});

		await command.execute([interaction] as any);

		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds[0].data.title).toBe('❌ Error');
		expect(payload.embeds[0].data.description).toBe('No music queue found');
		expect(payload.components).toBeUndefined();
	});

	it('shows the queue without pagination controls when it fits on one page', async () => {
		const interaction = makeInteraction();
		const songs = [
			buildSong({ name: 'Now' }),
			buildSong({ name: 'Next 1' }),
			buildSong({ name: 'Next 2' }),
		];
		musicService.validateGuildAndGetQueue.mockReturnValue({
			success: true,
			queue: buildQueue(songs),
		});

		await command.execute([interaction] as any);

		expect(interaction.editReply).toHaveBeenCalledTimes(1);
		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds[0].data.title).toContain('Page 1/1');
		expect(payload.embeds[0].data.description).toContain('Now');
		expect(payload.components).toBeUndefined();
	});

	it('adds pagination controls and attaches a collector for multi-page queues', async () => {
		const interaction = makeInteraction();
		// 14 songs => 13 upcoming => 2 pages at 10 per page
		const songs = Array.from({ length: 14 }, (_unused, index) =>
			buildSong({ name: `Song ${index}` }),
		);
		musicService.validateGuildAndGetQueue.mockReturnValue({
			success: true,
			queue: buildQueue(songs),
		});

		const collector = { on: jest.fn() };
		const message = {
			createMessageComponentCollector: jest.fn().mockReturnValue(collector),
			edit: jest.fn(),
		};
		interaction.editReply = jest.fn().mockResolvedValue(message);

		await command.execute([interaction] as any);

		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds[0].data.title).toContain('Page 1/2');
		expect(payload.components).toHaveLength(1);
		expect(message.createMessageComponentCollector).toHaveBeenCalledWith(
			expect.objectContaining({ componentType: ComponentType.Button }),
		);
		expect(collector.on).toHaveBeenCalledWith('collect', expect.any(Function));
		expect(collector.on).toHaveBeenCalledWith('end', expect.any(Function));
	});
});
