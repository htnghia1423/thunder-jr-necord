import { createMockInteraction } from '@test/helpers/discord';

import { PlayCommand } from './play.command';

// Stub the injected service module so importing the command does not pull in the
// heavy DisTube / ffmpeg / plugin dependency chain. A mock instance is injected below.
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
	thumbnail: 'https://img/thumb.jpg',
	uploader: { name: 'Test Uploader' },
	...overrides,
});

const buildQueue = (songs: any[]): any => ({
	songs,
	formattedDuration: '10:00',
	formattedCurrentTime: '00:30',
	currentTime: 30,
	repeatMode: 0,
	volume: 100,
});

describe('PlayCommand', () => {
	let musicService: any;
	let command: PlayCommand;

	beforeEach(() => {
		musicService = {
			play: jest.fn(),
			validateGuildAndGetQueue: jest.fn(),
		};
		command = new PlayCommand(musicService as any);
	});

	it('delegates to musicService.play and replies with an error embed when playback fails', async () => {
		const interaction = makeInteraction();
		musicService.play.mockResolvedValue({ success: false, message: 'boom' });

		await command.execute([interaction] as any, { song: 'never gonna' } as any);

		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		expect(musicService.play).toHaveBeenCalledWith(interaction, 'never gonna');
		expect(interaction.editReply).toHaveBeenCalledTimes(1);
		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds).toHaveLength(1);
		expect(payload.embeds[0].data.title).toBe('❌ Error');
		expect(payload.embeds[0].data.description).toBe('boom');
		expect(musicService.validateGuildAndGetQueue).not.toHaveBeenCalled();
	});

	it('replies with a plain content message for custom duplicate-detection messages', async () => {
		const interaction = makeInteraction();
		musicService.play.mockResolvedValue({
			success: true,
			message: '**Added playlist** with 5 songs',
		});

		await command.execute([interaction] as any, { song: 'list' } as any);

		expect(interaction.editReply).toHaveBeenCalledWith({
			content: '**Added playlist** with 5 songs',
		});
		expect(musicService.validateGuildAndGetQueue).not.toHaveBeenCalled();
	});

	it('shows a now playing embed for a single song that starts immediately', async () => {
		const interaction = makeInteraction();
		musicService.play.mockResolvedValue({
			success: true,
			message: 'Now playing',
			data: { isNowPlaying: true, isPlaylist: false },
		});
		musicService.validateGuildAndGetQueue.mockReturnValue({
			success: true,
			queue: buildQueue([buildSong()]),
		});

		await command.execute([interaction] as any, { song: 'test' } as any);

		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds).toHaveLength(1);
		expect(payload.embeds[0].data.title).toBe('🎵 Now Playing');
		expect(payload.embeds[0].data.description).toContain('Test Song');
	});

	it('shows an added-to-queue embed with the resolved queue position', async () => {
		const interaction = makeInteraction();
		const songs = [
			buildSong({ name: 'Current' }),
			buildSong({ name: 'A' }),
			buildSong({ name: 'B' }),
			buildSong({ name: 'Queued' }),
		];
		musicService.play.mockResolvedValue({
			success: true,
			message: 'Added',
			data: { isNowPlaying: false, isPlaylist: false, queuePosition: 2 },
		});
		musicService.validateGuildAndGetQueue.mockReturnValue({
			success: true,
			queue: buildQueue(songs),
		});

		await command.execute([interaction] as any, { song: 'queued' } as any);

		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds[0].data.title).toBe('🎵 Added to Queue');
		expect(payload.embeds[0].data.description).toContain('Queued');
		// queuePosition 2 -> actualPosition 3 -> songs[3] -> display position #4
		const positionField = payload.embeds[0].data.fields.find(
			(field: any) => field.name === '📍 Position',
		);
		expect(positionField.value).toBe('#4');
	});

	it('shows a playlist embed when a playlist is added', async () => {
		const interaction = makeInteraction();
		musicService.play.mockResolvedValue({
			success: true,
			message: 'Playlist added',
			data: { isPlaylist: true, isNowPlaying: true, songsAdded: 12 },
		});
		musicService.validateGuildAndGetQueue.mockReturnValue({
			success: true,
			queue: buildQueue([buildSong({ name: 'First Playlist Song' })]),
		});

		await command.execute(
			[interaction] as any,
			{ song: 'playlist url' } as any,
		);

		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds[0].data.title).toBe('📋 Now Playing Playlist');
		expect(payload.embeds[0].data.description).toContain('First Playlist Song');
		const songsField = payload.embeds[0].data.fields.find(
			(field: any) => field.name === '📊 Songs Added',
		);
		expect(songsField.value).toBe('12 songs');
	});

	it('falls back to a plain content message when the queue is unavailable after a successful play', async () => {
		const interaction = makeInteraction();
		musicService.play.mockResolvedValue({
			success: true,
			message: 'Started playing',
			data: { isNowPlaying: true },
		});
		musicService.validateGuildAndGetQueue.mockReturnValue({
			success: false,
			message: 'No music queue found',
		});

		await command.execute([interaction] as any, { song: 'test' } as any);

		expect(interaction.editReply).toHaveBeenCalledWith({
			content: 'Started playing',
		});
	});
});
