import { createMockInteraction } from '@test/helpers/discord';

import { NowPlayingCommand } from './nowplaying.command';

jest.mock('../services/music.service', () => ({
	MusicService: class {},
}));
jest.mock('../services/distube.service', () => ({
	DisTubeService: class {},
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
	uploader: { name: 'Test Uploader' },
	...overrides,
});

const buildQueue = (
	songs: any[],
	overrides: Record<string, unknown> = {},
): any => ({
	songs,
	formattedCurrentTime: '00:30',
	currentTime: 30,
	repeatMode: 0,
	volume: 100,
	paused: false,
	previousSongs: [],
	...overrides,
});

describe('NowPlayingCommand', () => {
	let musicService: any;
	let disTubeService: any;
	let command: NowPlayingCommand;

	beforeEach(() => {
		musicService = { validateGuildAndGetQueue: jest.fn() };
		disTubeService = { attachPlaybackControls: jest.fn() };
		command = new NowPlayingCommand(musicService, disTubeService);
	});

	it('replies with an error embed and does not attach controls when there is no queue', async () => {
		const interaction = makeInteraction();
		musicService.validateGuildAndGetQueue.mockReturnValue({
			success: false,
			message: 'No music queue found',
		});

		await command.execute([interaction] as any);

		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds[0].data.title).toBe('❌ Error');
		expect(disTubeService.attachPlaybackControls).not.toHaveBeenCalled();
	});

	it('replies with the now playing embed plus controls and attaches the collector', async () => {
		const interaction = makeInteraction();
		const queue = buildQueue([buildSong({ name: 'Current Jam' })], {
			previousSongs: [buildSong()],
		});
		musicService.validateGuildAndGetQueue.mockReturnValue({
			success: true,
			queue,
		});
		const message = { id: 'np-message' };
		interaction.editReply = jest.fn().mockResolvedValue(message);

		await command.execute([interaction] as any);

		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds[0].data.title).toBe('🎶 Now Playing');
		expect(payload.embeds[0].data.description).toContain('Current Jam');
		expect(Array.isArray(payload.components)).toBe(true);
		expect(payload.components.length).toBeGreaterThan(0);
		expect(disTubeService.attachPlaybackControls).toHaveBeenCalledTimes(1);
		expect(disTubeService.attachPlaybackControls).toHaveBeenCalledWith(
			message,
			queue,
		);
	});
});
