import { MusicResponse } from '../enums/music.enum';
import { Logger } from '@nestjs/common';
import { createMockInteraction } from '@test/helpers/discord';

import { PlayMusicService } from './play-music.service';

const buildDeps = () => {
	const distube = {
		getQueue: jest.fn(),
		play: jest.fn().mockResolvedValue(undefined),
		createCustomPlaylist: jest.fn(),
	};
	const distubeService = {
		getDistube: jest.fn().mockReturnValue(distube),
	} as any;
	const playlistDuplicateService = {
		processPlaylistDuplicates: jest.fn(),
	} as any;
	const youtubeApiService = { getPlaylistItems: jest.fn() } as any;
	const playlistOptimizationService = {
		isYouTubeStandardPlaylist: jest.fn().mockReturnValue(false),
		stripMixParameters: jest.fn((url: string) => url),
	} as any;
	const playResultFormatterService = {
		createSuccessResult: jest.fn(),
		getSingleSongDuplicateWarning: jest.fn().mockReturnValue(''),
	} as any;

	const service = new PlayMusicService(
		distubeService,
		playlistDuplicateService,
		youtubeApiService,
		playlistOptimizationService,
		playResultFormatterService,
	);

	return {
		service,
		distube,
		distubeService,
		playlistDuplicateService,
		youtubeApiService,
		playlistOptimizationService,
		playResultFormatterService,
	};
};

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('PlayMusicService.parseDistubeError', () => {
	const parse = (service: PlayMusicService, error: unknown): string =>
		(service as any).parseDistubeError(error);

	it('maps age-restriction errors to the age-restricted response', () => {
		const { service } = buildDeps();
		expect(
			parse(service, new Error('Sign in to confirm your age (restricted)')),
		).toBe(MusicResponse.PLAY_ERROR_AGE_RESTRICTED);
	});

	it('maps private-video errors', () => {
		const { service } = buildDeps();
		expect(parse(service, new Error('This is a private video'))).toBe(
			MusicResponse.PLAY_ERROR_PRIVATE,
		);
	});

	it('maps region/country blocks (checked before generic unavailability)', () => {
		const { service } = buildDeps();
		expect(parse(service, new Error('Not available in your country'))).toBe(
			MusicResponse.PLAY_ERROR_REGION_BLOCKED,
		);
	});

	it('maps unavailable/removed videos', () => {
		const { service } = buildDeps();
		expect(parse(service, new Error('Video unavailable'))).toBe(
			MusicResponse.PLAY_ERROR_UNAVAILABLE,
		);
	});

	it('falls back to the generic play error for unrecognized messages', () => {
		const { service } = buildDeps();
		expect(parse(service, new Error('kaboom'))).toBe(MusicResponse.PLAY_ERROR);
	});

	it('handles non-Error values by stringifying them', () => {
		const { service } = buildDeps();
		expect(parse(service, 'a private matter')).toBe(
			MusicResponse.PLAY_ERROR_PRIVATE,
		);
	});
});

describe('PlayMusicService.play', () => {
	it('resolves the validation failure and never touches DisTube when the user is not in a voice channel', async () => {
		const { service, distube, distubeService } = buildDeps();
		const interaction = createMockInteraction({ voiceChannelId: null });

		const result = await service.play(interaction, 'never gonna give you up');

		expect(result).toEqual({
			success: false,
			message: MusicResponse.NOT_IN_VOICE_CHANNEL,
		});
		expect(distubeService.getDistube).not.toHaveBeenCalled();
		expect(distube.play).not.toHaveBeenCalled();
	});

	it('plays a single song via DisTube and resolves the formatter success result', async () => {
		const { service, distube, playResultFormatterService } = buildDeps();
		const interaction = createMockInteraction();
		const finalQueue = {
			songs: [{ name: 'Song A', formattedDuration: '3:00' }],
		};
		distube.getQueue
			.mockReturnValueOnce(undefined) // existingQueue in executePlay
			.mockReturnValueOnce(finalQueue); // finalQueue in handlePlaySuccess
		const sentinel = { success: true, message: 'formatted-result' };
		playResultFormatterService.createSuccessResult.mockReturnValue(sentinel);

		const result = await service.play(interaction, 'https://example.com/song');

		expect(distube.play).toHaveBeenCalledTimes(1);
		const [voiceChannel, query, options] = distube.play.mock.calls[0];
		expect(query).toBe('https://example.com/song');
		expect(voiceChannel).toBe(interaction.member.voice.channel);
		expect(options.member).toBe(interaction.member);

		// wasQueueEmpty=true, isPlaylist=false, songsAdded=1, originalQueueLength=0
		expect(playResultFormatterService.createSuccessResult).toHaveBeenCalledWith(
			finalQueue.songs[0],
			true,
			false,
			1,
			0,
			'',
		);
		expect(result).toBe(sentinel);
	});

	it('translates a DisTube playback rejection into a specific error message', async () => {
		const { service, distube } = buildDeps();
		const interaction = createMockInteraction();
		distube.getQueue.mockReturnValue(undefined);
		distube.play.mockRejectedValue(
			new Error('Sign in to confirm your age — this video is restricted'),
		);

		const result = await service.play(interaction, 'https://example.com/song');

		expect(result).toEqual({
			success: false,
			message: MusicResponse.PLAY_ERROR_AGE_RESTRICTED,
		});
	});

	it('shows a loading message then falls back to yt-dlp with a stripped URL when the YouTube API returns nothing', async () => {
		const { service, distube, youtubeApiService, playlistOptimizationService } =
			buildDeps();
		const interaction = createMockInteraction();
		playlistOptimizationService.isYouTubeStandardPlaylist.mockReturnValue(true);
		youtubeApiService.getPlaylistItems.mockResolvedValue([]);
		playlistOptimizationService.stripMixParameters.mockReturnValue(
			'https://www.youtube.com/watch?v=abc',
		);
		distube.getQueue.mockReturnValue(undefined);

		const query = 'https://www.youtube.com/watch?v=abc&list=PL123';
		await service.play(interaction, query);

		// Playlist loading message is shown up-front
		expect(interaction.editReply).toHaveBeenCalledWith(
			expect.stringContaining('YouTube API'),
		);
		// The API is attempted with the original query
		expect(youtubeApiService.getPlaylistItems).toHaveBeenCalledWith(query);
		// On empty API result it strips the URL and falls back to yt-dlp
		expect(playlistOptimizationService.stripMixParameters).toHaveBeenCalledWith(
			query,
		);
		expect(distube.createCustomPlaylist).not.toHaveBeenCalled();
		expect(distube.play).toHaveBeenCalledTimes(1);
		expect(distube.play.mock.calls[0][1]).toBe(
			'https://www.youtube.com/watch?v=abc',
		);
	});
});

describe('PlayMusicService.createSuccessResult', () => {
	it('delegates to the formatter service with the provided arguments', () => {
		const { service, playResultFormatterService } = buildDeps();
		const sentinel = { success: true } as any;
		playResultFormatterService.createSuccessResult.mockReturnValue(sentinel);
		const song = { name: 'S' } as any;

		const out = service.createSuccessResult(song, true, false, 1, 0, 'warn');

		expect(out).toBe(sentinel);
		expect(playResultFormatterService.createSuccessResult).toHaveBeenCalledWith(
			song,
			true,
			false,
			1,
			0,
			'warn',
		);
	});
});
