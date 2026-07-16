import { MusicResponse } from '../enums/music.enum';
import { MusicConstants } from '../music.constants';
import { Logger } from '@nestjs/common';
import { ComponentType } from 'discord.js';

import { DisTubeService } from './distube.service';
import { LyricsNotFoundError } from './lyrics.service';

const buildService = () => {
	const client = {} as any;
	const musicStatsService = { recordPlay: jest.fn() } as any;
	const lyricsService = {
		getLyricsForSong: jest.fn(),
		splitLyricsIntoChunks: jest.fn(),
	} as any;
	const service = new DisTubeService(client, musicStatsService, lyricsService);
	return { service, client, musicStatsService, lyricsService };
};

const buildButtonInteraction = (over: Record<string, unknown> = {}): any => ({
	user: { id: 'u1' },
	customId: 'music_skip',
	guild: {
		members: {
			cache: new Map([['u1', { voice: { channel: { id: 'vc1' } } }]]),
		},
	},
	message: { edit: jest.fn().mockResolvedValue(undefined) },
	reply: jest.fn().mockResolvedValue(undefined),
	deferReply: jest.fn().mockResolvedValue(undefined),
	deferUpdate: jest.fn().mockResolvedValue(undefined),
	editReply: jest.fn().mockResolvedValue({ id: 'msg-1' }),
	...over,
});

const buildQueue = (over: Record<string, unknown> = {}): any => ({
	voiceChannel: { id: 'vc1' },
	paused: false,
	repeatMode: 0,
	songs: [{ name: 'Song A', uploader: { name: 'Artist A' } }],
	previousSongs: [],
	previous: jest.fn().mockResolvedValue(undefined),
	resume: jest.fn().mockResolvedValue(undefined),
	pause: jest.fn().mockResolvedValue(undefined),
	stop: jest.fn().mockResolvedValue(undefined),
	skip: jest.fn().mockResolvedValue(undefined),
	setRepeatMode: jest.fn(),
	...over,
});

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.restoreAllMocks();
});

// Access the private handler under test.
const invokeButton = (
	service: DisTubeService,
	interaction: any,
	queue: any,
): Promise<void> =>
	(service as any).handlePlaybackButtonInteraction(interaction, queue);

describe('DisTubeService.handlePlaybackButtonInteraction', () => {
	it('rejects control usage when the user is not in the same voice channel as the bot', async () => {
		const { service } = buildService();
		const queue = buildQueue({ voiceChannel: { id: 'different-vc' } });
		const interaction = buildButtonInteraction({ customId: 'music_skip' });

		await invokeButton(service, interaction, queue);

		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: MusicResponse.NOT_IN_SAME_VOICE_CHANNEL,
			}),
		);
		expect(queue.skip).not.toHaveBeenCalled();
	});

	it('plays the previous song for music_prev', async () => {
		const { service } = buildService();
		jest
			.spyOn(service as any, 'updateNowPlayingMessage')
			.mockResolvedValue(undefined);
		const queue = buildQueue();
		const interaction = buildButtonInteraction({ customId: 'music_prev' });

		await invokeButton(service, interaction, queue);

		expect(queue.previous).toHaveBeenCalledTimes(1);
		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining('previous') }),
		);
	});

	it('pauses when currently playing for music_play_pause', async () => {
		const { service } = buildService();
		jest
			.spyOn(service as any, 'updateNowPlayingMessage')
			.mockResolvedValue(undefined);
		const queue = buildQueue({ paused: false });
		const interaction = buildButtonInteraction({
			customId: 'music_play_pause',
		});

		await invokeButton(service, interaction, queue);

		expect(queue.pause).toHaveBeenCalledTimes(1);
		expect(queue.resume).not.toHaveBeenCalled();
		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining('Paused') }),
		);
	});

	it('resumes when currently paused for music_play_pause', async () => {
		const { service } = buildService();
		jest
			.spyOn(service as any, 'updateNowPlayingMessage')
			.mockResolvedValue(undefined);
		const queue = buildQueue({ paused: true });
		const interaction = buildButtonInteraction({
			customId: 'music_play_pause',
		});

		await invokeButton(service, interaction, queue);

		expect(queue.resume).toHaveBeenCalledTimes(1);
		expect(queue.pause).not.toHaveBeenCalled();
		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining('Resumed') }),
		);
	});

	it('stops playback for music_stop', async () => {
		const { service } = buildService();
		jest
			.spyOn(service as any, 'updateNowPlayingMessage')
			.mockResolvedValue(undefined);
		const queue = buildQueue();
		const interaction = buildButtonInteraction({ customId: 'music_stop' });

		await invokeButton(service, interaction, queue);

		expect(queue.stop).toHaveBeenCalledTimes(1);
	});

	it('skips the current song and refreshes the message for music_skip', async () => {
		const { service } = buildService();
		const updateSpy = jest
			.spyOn(service as any, 'updateNowPlayingMessage')
			.mockResolvedValue(undefined);
		const queue = buildQueue();
		const interaction = buildButtonInteraction({ customId: 'music_skip' });

		await invokeButton(service, interaction, queue);

		expect(queue.skip).toHaveBeenCalledTimes(1);
		// non-returning branches fall through to the message refresh
		expect(updateSpy).toHaveBeenCalledWith(interaction, queue);
	});

	it('advances the repeat mode from Off to Song for music_loop', async () => {
		const { service } = buildService();
		jest
			.spyOn(service as any, 'updateNowPlayingMessage')
			.mockResolvedValue(undefined);
		const queue = buildQueue({ repeatMode: 0 });
		const interaction = buildButtonInteraction({ customId: 'music_loop' });

		await invokeButton(service, interaction, queue);

		expect(queue.setRepeatMode).toHaveBeenCalledWith(1);
		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining('Song') }),
		);
	});

	it('wraps the repeat mode from Queue back to Off for music_loop', async () => {
		const { service } = buildService();
		jest
			.spyOn(service as any, 'updateNowPlayingMessage')
			.mockResolvedValue(undefined);
		const queue = buildQueue({ repeatMode: 2 });
		const interaction = buildButtonInteraction({ customId: 'music_loop' });

		await invokeButton(service, interaction, queue);

		expect(queue.setRepeatMode).toHaveBeenCalledWith(0);
		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining('Off') }),
		);
	});

	it('defers and refreshes without further action for music_refresh', async () => {
		const { service } = buildService();
		const updateSpy = jest
			.spyOn(service as any, 'updateNowPlayingMessage')
			.mockResolvedValue(undefined);
		const queue = buildQueue();
		const interaction = buildButtonInteraction({ customId: 'music_refresh' });

		await invokeButton(service, interaction, queue);

		expect(interaction.deferUpdate).toHaveBeenCalledTimes(1);
		expect(updateSpy).toHaveBeenCalledWith(interaction, queue);
		// music_refresh returns early so no reply is sent
		expect(interaction.reply).not.toHaveBeenCalled();
	});

	it('routes music_lyrics to the lyrics presenter', async () => {
		const { service } = buildService();
		const lyricsSpy = jest
			.spyOn(service as any, 'showLyricsForQueue')
			.mockResolvedValue(undefined);
		const queue = buildQueue();
		const interaction = buildButtonInteraction({ customId: 'music_lyrics' });

		await invokeButton(service, interaction, queue);

		expect(lyricsSpy).toHaveBeenCalledWith(interaction, queue);
	});

	it('replies with an unknown-action message for an unrecognized button', async () => {
		const { service } = buildService();
		jest
			.spyOn(service as any, 'updateNowPlayingMessage')
			.mockResolvedValue(undefined);
		const queue = buildQueue();
		const interaction = buildButtonInteraction({ customId: 'music_bogus' });

		await invokeButton(service, interaction, queue);

		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining('Unknown') }),
		);
	});
});

describe('DisTubeService.showLyricsForQueue', () => {
	const invokeLyrics = (
		service: DisTubeService,
		interaction: any,
		queue: any,
	): Promise<void> => (service as any).showLyricsForQueue(interaction, queue);

	it('reports when there is no current song and never queries the lyrics service', async () => {
		const { service, lyricsService } = buildService();
		const interaction = buildButtonInteraction();
		const queue = buildQueue({ songs: [] });

		await invokeLyrics(service, interaction, queue);

		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		expect(lyricsService.getLyricsForSong).not.toHaveBeenCalled();
		expect(interaction.editReply).toHaveBeenCalledTimes(1);
		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds).toHaveLength(1);
	});

	it('fetches lyrics for the current song and renders a single embed when it fits one chunk', async () => {
		const { service, lyricsService } = buildService();
		lyricsService.getLyricsForSong.mockResolvedValue({
			title: 'Song A',
			artist: 'Artist A',
			lyrics: 'la la la',
			thumbnail: undefined,
		});
		lyricsService.splitLyricsIntoChunks.mockReturnValue(['la la la']);
		const interaction = buildButtonInteraction();
		const queue = buildQueue();

		await invokeLyrics(service, interaction, queue);

		expect(lyricsService.getLyricsForSong).toHaveBeenCalledWith(
			'Song A',
			'Artist A',
		);
		expect(lyricsService.splitLyricsIntoChunks).toHaveBeenCalledWith(
			'la la la',
		);
		// last editReply carries a single embed
		const lastPayload = interaction.editReply.mock.calls.at(-1)[0];
		expect(lastPayload.embeds).toHaveLength(1);
	});

	it('surfaces a not-found tip when the lyrics service throws LyricsNotFoundError', async () => {
		const { service, lyricsService } = buildService();
		lyricsService.getLyricsForSong.mockRejectedValue(
			new LyricsNotFoundError('no match', 'No lyrics found for Song A.'),
		);
		const interaction = buildButtonInteraction();
		const queue = buildQueue();

		await invokeLyrics(service, interaction, queue);

		const lastPayload = interaction.editReply.mock.calls.at(-1)[0];
		expect(lastPayload.embeds).toHaveLength(1);
		const description = lastPayload.embeds[0].data.description as string;
		expect(description).toContain('No lyrics found for Song A.');
		expect(description).toContain('/lyrics');
	});
});

describe('DisTubeService.attachPlaybackControls', () => {
	it('configures a button collector and routes collected clicks to the handler', () => {
		const { service } = buildService();
		const handlerSpy = jest
			.spyOn(service as any, 'handlePlaybackButtonInteraction')
			.mockResolvedValue(undefined);

		const listeners: Record<string, (arg?: unknown) => void> = {};
		const collector = {
			on: jest.fn((event: string, cb: (arg?: unknown) => void) => {
				listeners[event] = cb;
			}),
		};
		const message = {
			createMessageComponentCollector: jest.fn().mockReturnValue(collector),
		} as any;
		const queue = buildQueue();

		service.attachPlaybackControls(message, queue);

		expect(message.createMessageComponentCollector).toHaveBeenCalledWith(
			expect.objectContaining({
				componentType: ComponentType.Button,
				time: MusicConstants.BUTTON_COLLECTOR_TIMEOUT,
			}),
		);
		expect(collector.on).toHaveBeenCalledWith('collect', expect.any(Function));
		expect(collector.on).toHaveBeenCalledWith('end', expect.any(Function));

		const buttonInteraction = buildButtonInteraction();
		listeners.collect(buttonInteraction);
		expect(handlerSpy).toHaveBeenCalledWith(buttonInteraction, queue);
	});
});

describe('DisTubeService.onModuleDestroy', () => {
	it('stops every active queue, leaves each voice channel and removes listeners', async () => {
		const { service } = buildService();
		const q1 = { id: 'g1', stop: jest.fn().mockResolvedValue(undefined) };
		const q2 = { id: 'g2', stop: jest.fn().mockResolvedValue(undefined) };
		const leave = jest.fn();
		const removeAllListeners = jest.fn();
		(service as any).distube = {
			queues: {
				collection: new Map([
					['g1', q1],
					['g2', q2],
				]),
			},
			voices: {
				collection: new Map([
					['g1', { id: 'g1' }],
					['g2', { id: 'g2' }],
				]),
				leave,
			},
			removeAllListeners,
		};

		await service.onModuleDestroy();

		expect(q1.stop).toHaveBeenCalledTimes(1);
		expect(q2.stop).toHaveBeenCalledTimes(1);
		expect(leave).toHaveBeenCalledWith('g1');
		expect(leave).toHaveBeenCalledWith('g2');
		expect(removeAllListeners).toHaveBeenCalledTimes(1);
	});

	it('continues cleanup even when stopping one queue rejects', async () => {
		const { service } = buildService();
		const q1 = {
			id: 'g1',
			stop: jest.fn().mockRejectedValue(new Error('boom')),
		};
		const q2 = { id: 'g2', stop: jest.fn().mockResolvedValue(undefined) };
		const leave = jest.fn();
		const removeAllListeners = jest.fn();
		(service as any).distube = {
			queues: {
				collection: new Map([
					['g1', q1],
					['g2', q2],
				]),
			},
			voices: {
				collection: new Map([['g2', { id: 'g2' }]]),
				leave,
			},
			removeAllListeners,
		};

		await expect(service.onModuleDestroy()).resolves.toBeUndefined();
		expect(q1.stop).toHaveBeenCalledTimes(1);
		expect(q2.stop).toHaveBeenCalledTimes(1);
		expect(removeAllListeners).toHaveBeenCalledTimes(1);
	});
});
