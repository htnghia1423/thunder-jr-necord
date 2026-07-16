import { LyricsNotFoundError } from '../services/lyrics.service';
import { Logger } from '@nestjs/common';
import { createMockInteraction } from '@test/helpers/discord';
import { ComponentType } from 'discord.js';

import { LyricsCommand } from './lyrics.command';

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

describe('LyricsCommand', () => {
	let lyricsService: any;
	let musicService: any;
	let disTubeService: any;
	let command: LyricsCommand;

	beforeEach(() => {
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		lyricsService = {
			getLyrics: jest.fn(),
			getLyricsForSong: jest.fn(),
			splitLyricsIntoChunks: jest.fn(),
		};
		musicService = { validateGuildAndGetQueue: jest.fn() };
		disTubeService = {};
		command = new LyricsCommand(lyricsService, musicService, disTubeService);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('fetches lyrics for an explicit query and renders a single-page embed', async () => {
		const interaction = makeInteraction();
		lyricsService.getLyrics.mockResolvedValue({
			title: 'Bohemian Rhapsody',
			artist: 'Queen',
			lyrics: 'Is this the real life',
		});
		lyricsService.splitLyricsIntoChunks.mockReturnValue([
			'Is this the real life',
		]);

		await command.execute([interaction] as any, { query: 'Bohemian Rhapsody' });

		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		expect(lyricsService.getLyrics).toHaveBeenCalledWith('Bohemian Rhapsody');
		expect(lyricsService.splitLyricsIntoChunks).toHaveBeenCalledWith(
			'Is this the real life',
		);
		expect(musicService.validateGuildAndGetQueue).not.toHaveBeenCalled();
		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds[0].data.title).toBe('🎤 Lyrics: Bohemian Rhapsody');
		expect(payload.components).toBeUndefined();
	});

	it('auto-detects the current song when no query is provided', async () => {
		const interaction = makeInteraction();
		musicService.validateGuildAndGetQueue.mockReturnValue({
			success: true,
			queue: {
				songs: [{ name: 'Yesterday', uploader: { name: 'The Beatles' } }],
			},
		});
		lyricsService.getLyricsForSong.mockResolvedValue({
			title: 'Yesterday',
			artist: 'The Beatles',
			lyrics: 'All my troubles seemed so far away',
		});
		lyricsService.splitLyricsIntoChunks.mockReturnValue([
			'All my troubles seemed so far away',
		]);

		await command.execute([interaction] as any, {});

		expect(lyricsService.getLyricsForSong).toHaveBeenCalledWith(
			'Yesterday',
			'The Beatles',
		);
		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds[0].data.title).toBe('🎤 Lyrics: Yesterday');
	});

	it('shows an error embed when auto-detect finds no active queue', async () => {
		const interaction = makeInteraction();
		musicService.validateGuildAndGetQueue.mockReturnValue({
			success: false,
			message: 'No music queue found',
		});

		await command.execute([interaction] as any, {});

		expect(lyricsService.getLyricsForSong).not.toHaveBeenCalled();
		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds[0].data.title).toBe('❌ Error');
		expect(payload.embeds[0].data.description).toContain(
			'No song is currently playing',
		);
	});

	it('shows an error embed when the current song has no name', async () => {
		const interaction = makeInteraction();
		musicService.validateGuildAndGetQueue.mockReturnValue({
			success: true,
			queue: { songs: [{ name: '' }] },
		});

		await command.execute([interaction] as any, {});

		expect(lyricsService.getLyricsForSong).not.toHaveBeenCalled();
		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds[0].data.description).toContain(
			'Could not detect current song',
		);
	});

	it('adds pagination controls when lyrics span multiple pages', async () => {
		const interaction = makeInteraction();
		lyricsService.getLyrics.mockResolvedValue({
			title: 'Long Song',
			artist: 'Band',
			lyrics: 'page one\npage two',
		});
		lyricsService.splitLyricsIntoChunks.mockReturnValue([
			'page one',
			'page two',
		]);
		const collector = { on: jest.fn() };
		const message = {
			createMessageComponentCollector: jest.fn().mockReturnValue(collector),
			edit: jest.fn(),
		};
		interaction.editReply = jest.fn().mockResolvedValue(message);

		await command.execute([interaction] as any, { query: 'Long Song' });

		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds[0].data.title).toBe('🎤 Lyrics: Long Song');
		expect(payload.components).toHaveLength(1);
		expect(message.createMessageComponentCollector).toHaveBeenCalledWith(
			expect.objectContaining({ componentType: ComponentType.Button }),
		);
		expect(collector.on).toHaveBeenCalledWith('collect', expect.any(Function));
		expect(collector.on).toHaveBeenCalledWith('end', expect.any(Function));
	});

	it('renders a friendly error embed for LyricsNotFoundError', async () => {
		const interaction = makeInteraction();
		lyricsService.getLyrics.mockRejectedValue(
			new LyricsNotFoundError(
				'no lyrics',
				'I could not find lyrics for **X**.',
			),
		);

		await command.execute([interaction] as any, { query: 'X' });

		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds[0].data.title).toBe('❌ Error');
		expect(payload.embeds[0].data.description).toContain(
			'I could not find lyrics for **X**.',
		);
	});

	it('renders an informative error embed for other failures', async () => {
		const interaction = makeInteraction();
		lyricsService.getLyrics.mockRejectedValue(
			new Error('No results found for query'),
		);

		await command.execute([interaction] as any, { query: 'obscure' });

		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds[0].data.title).toBe('❌ Error');
		expect(payload.embeds[0].data.description).toContain(
			'No results found for query',
		);
	});
});
