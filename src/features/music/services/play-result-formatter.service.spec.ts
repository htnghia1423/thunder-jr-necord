import { MusicResponse } from '../enums/music.enum';
import type {
	ExtendedQueue,
	ExtendedSong,
} from '../interfaces/distube-types.interface';

import { PlayResultFormatterService } from './play-result-formatter.service';

const makeSong = (over: Record<string, any> = {}): ExtendedSong =>
	({
		name: 'Song A',
		url: 'https://youtu.be/a',
		formattedDuration: '03:00',
		uploader: { name: 'Artist A' },
		...over,
	}) as unknown as ExtendedSong;

const makeQueue = (songs: ExtendedSong[]): ExtendedQueue =>
	({ songs }) as unknown as ExtendedQueue;

describe('PlayResultFormatterService.createSuccessResult', () => {
	let service: PlayResultFormatterService;

	beforeEach(() => {
		service = new PlayResultFormatterService();
	});

	it('marks the song as now playing with position 0 when the queue was empty', () => {
		const song = makeSong({ name: 'Hello', formattedDuration: '02:30' });

		const result = service.createSuccessResult(song, true, false, 1, 5, '');

		expect(result.success).toBe(true);
		expect(result.message).toBe(MusicResponse.SONG_ADDED);
		expect(result.data).toMatchObject({
			songName: 'Hello',
			duration: '02:30',
			isNowPlaying: true,
			wasQueueEmpty: true,
			isPlaylist: false,
			songsAdded: 1,
			queuePosition: 0,
			duplicateWarning: '',
		});
	});

	it('computes queuePosition as originalQueueLength - 1 when the queue was not empty', () => {
		const result = service.createSuccessResult(
			makeSong(),
			false,
			false,
			1,
			5,
			'a warning',
		);

		expect(result.data?.isNowPlaying).toBe(false);
		expect(result.data?.queuePosition).toBe(4);
		expect(result.data?.duplicateWarning).toBe('a warning');
	});

	it('handles an undefined current song without throwing', () => {
		const result = service.createSuccessResult(
			undefined,
			true,
			true,
			10,
			1,
			'',
		);

		expect(result.success).toBe(true);
		expect(result.data?.songName).toBeUndefined();
		expect(result.data?.duration).toBeUndefined();
		expect(result.data?.isPlaylist).toBe(true);
		expect(result.data?.songsAdded).toBe(10);
	});
});

describe('PlayResultFormatterService.createErrorResult', () => {
	it('returns a failed result carrying the supplied message and no data', () => {
		const service = new PlayResultFormatterService();

		const result = service.createErrorResult('boom');

		expect(result.success).toBe(false);
		expect(result.message).toBe('boom');
		expect(result.data).toBeUndefined();
	});
});

describe('PlayResultFormatterService.getSingleSongDuplicateWarning', () => {
	let service: PlayResultFormatterService;

	beforeEach(() => {
		service = new PlayResultFormatterService();
	});

	it('returns an empty string for playlists', () => {
		const warning = service.getSingleSongDuplicateWarning(
			true,
			false,
			makeQueue([makeSong()]),
			1,
			makeSong(),
		);

		expect(warning).toBe('');
	});

	it('returns an empty string when the queue was empty (nothing to check)', () => {
		const warning = service.getSingleSongDuplicateWarning(
			false,
			true,
			makeQueue([makeSong()]),
			1,
			makeSong(),
		);

		expect(warning).toBe('');
	});

	it('returns an empty string when the final queue is null', () => {
		const warning = service.getSingleSongDuplicateWarning(
			false,
			false,
			null,
			3,
			makeSong(),
		);

		expect(warning).toBe('');
	});

	it('returns an empty string when there is no current song', () => {
		const warning = service.getSingleSongDuplicateWarning(
			false,
			false,
			makeQueue([makeSong()]),
			1,
			undefined,
		);

		expect(warning).toBe('');
	});

	it('returns an empty string when the song is not a duplicate', () => {
		const current = makeSong({
			url: 'https://youtu.be/new',
			name: 'New Song',
			uploader: { name: 'New Artist' },
		});
		const queue = makeQueue([
			makeSong({
				url: 'https://youtu.be/old',
				name: 'Old Song',
				uploader: { name: 'Old Artist' },
			}),
		]);

		const warning = service.getSingleSongDuplicateWarning(
			false,
			false,
			queue,
			1,
			current,
		);

		expect(warning).toBe('');
	});

	it('returns a duplicate warning when the song is already in the checked slice', () => {
		const existing = makeSong({
			url: 'https://youtu.be/same',
			name: 'Same Song',
			uploader: { name: 'Same Artist' },
		});
		const current = makeSong({
			url: 'https://youtu.be/same',
			name: 'Same Song',
			uploader: { name: 'Same Artist' },
		});

		const warning = service.getSingleSongDuplicateWarning(
			false,
			false,
			makeQueue([existing]),
			1,
			current,
		);

		expect(warning.startsWith('\n\n')).toBe(true);
		expect(warning).toContain('already in queue');
		expect(warning).toContain('#1');
		expect(warning).toContain('exact match');
	});
});
