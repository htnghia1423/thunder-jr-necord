import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { YoutubeApiService } from './youtube-api.service';

jest.mock('axios');

const mockedGet = axios.get as unknown as jest.Mock;

interface ThumbnailSet {
	default?: { url: string };
	medium?: { url: string };
	high?: { url: string };
}

function playlistItem(opts: {
	id: string;
	title?: string;
	uploader?: string;
	thumbnails?: ThumbnailSet;
}): unknown {
	return {
		snippet: {
			title: opts.title ?? `Title ${opts.id}`,
			videoOwnerChannelTitle: opts.uploader,
			thumbnails: opts.thumbnails,
			resourceId: { videoId: opts.id },
		},
	};
}

/**
 * Wire the mocked axios so that:
 * - `/playlistItems` walks `pages` using auto-generated pageTokens.
 * - `/videos` returns contentDetails only for ids present in `durations`
 *   (missing ids simulate deleted / private videos).
 */
function mockYoutube(
	pages: unknown[][],
	durations: Record<string, string | undefined>,
): void {
	mockedGet.mockImplementation((url: string, config: { params?: any } = {}) => {
		const params = config.params ?? {};

		if (url.endsWith('/playlistItems')) {
			const token = params.pageToken as string | undefined;
			const index = token ? Number(token.slice('token-'.length)) : 0;
			const isLast = index >= pages.length - 1;
			return Promise.resolve({
				data: {
					items: pages[index],
					nextPageToken: isLast ? undefined : `token-${index + 1}`,
				},
			});
		}

		if (url.endsWith('/videos')) {
			const ids = String(params.id).split(',');
			const items = ids
				.filter((id) => durations[id] !== undefined)
				.map((id) => ({ id, contentDetails: { duration: durations[id] } }));
			return Promise.resolve({ data: { items } });
		}

		return Promise.reject(new Error(`unexpected url: ${url}`));
	});
}

describe('YoutubeApiService', () => {
	let service: YoutubeApiService;
	let configGet: jest.Mock;

	const PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PL123';

	beforeAll(() => {
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterAll(() => {
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		mockedGet.mockReset();
		configGet = jest.fn().mockReturnValue('test-key');
		service = new YoutubeApiService({
			get: configGet,
		} as unknown as ConfigService);
	});

	describe('getPlaylistItems - guard clauses', () => {
		it('returns null and skips network calls when the url has no list param', async () => {
			const result = await service.getPlaylistItems(
				'https://www.youtube.com/watch?v=abc',
			);

			expect(result).toBeNull();
			expect(mockedGet).not.toHaveBeenCalled();
			// Fails before the API key is ever read.
			expect(configGet).not.toHaveBeenCalled();
		});

		it('returns null and skips network calls when YOUTUBE_API_KEY is missing', async () => {
			configGet.mockReturnValue(undefined);

			const result = await service.getPlaylistItems(PLAYLIST_URL);

			expect(result).toBeNull();
			expect(configGet).toHaveBeenCalledWith('YOUTUBE_API_KEY');
			expect(mockedGet).not.toHaveBeenCalled();
		});
	});

	describe('getPlaylistItems - happy path', () => {
		it('paginates, maps metadata, resolves durations and picks the best thumbnail', async () => {
			mockYoutube(
				[
					[
						playlistItem({
							id: 'a',
							title: 'Song A',
							uploader: 'Chan A',
							thumbnails: {
								high: { url: 'a-high' },
								medium: { url: 'a-med' },
								default: { url: 'a-def' },
							},
						}),
						playlistItem({
							id: 'b',
							title: 'Song B',
							uploader: 'Chan B',
							thumbnails: {
								medium: { url: 'b-med' },
								default: { url: 'b-def' },
							},
						}),
					],
					[
						playlistItem({
							id: 'c',
							title: 'Song C',
							thumbnails: { default: { url: 'c-def' } },
						}),
					],
				],
				{ a: 'PT4M13S', b: 'PT1H2M10S', c: 'PT15S' },
			);

			const result = await service.getPlaylistItems(PLAYLIST_URL);

			expect(result).toEqual([
				{
					name: 'Song A',
					id: 'a',
					url: 'https://www.youtube.com/watch?v=a',
					thumbnail: 'a-high', // high preferred over medium/default
					uploader: 'Chan A',
					duration: 253,
				},
				{
					name: 'Song B',
					id: 'b',
					url: 'https://www.youtube.com/watch?v=b',
					thumbnail: 'b-med', // falls back to medium when high missing
					uploader: 'Chan B',
					duration: 3730,
				},
				{
					name: 'Song C',
					id: 'c',
					url: 'https://www.youtube.com/watch?v=c',
					thumbnail: 'c-def', // falls back to default
					uploader: undefined,
					duration: 15,
				},
			]);
		});

		it('sends the list/api-key params and passes the nextPageToken on the second page', async () => {
			mockYoutube([[playlistItem({ id: 'a' })], [playlistItem({ id: 'b' })]], {
				a: 'PT10S',
				b: 'PT20S',
			});

			await service.getPlaylistItems(PLAYLIST_URL);

			const playlistCalls = mockedGet.mock.calls.filter(([u]) =>
				String(u).endsWith('/playlistItems'),
			);
			expect(playlistCalls).toHaveLength(2);

			expect(playlistCalls[0][1].params).toEqual({
				part: 'snippet',
				maxResults: '50',
				playlistId: 'PL123',
				key: 'test-key',
			});
			// second page must forward the pagination cursor
			expect(playlistCalls[1][1].params.pageToken).toBe('token-1');

			const videoCalls = mockedGet.mock.calls.filter(([u]) =>
				String(u).endsWith('/videos'),
			);
			expect(videoCalls).toHaveLength(1);
			expect(videoCalls[0][1].params).toEqual({
				part: 'contentDetails',
				id: 'a,b',
				key: 'test-key',
			});
		});
	});

	describe('getPlaylistItems - duration parsing via public API', () => {
		it('converts every ISO 8601 duration variant into seconds', async () => {
			const durations: Record<string, string> = {
				secs: 'PT45S',
				mins: 'PT4M13S',
				hours: 'PT1H2M10S',
				days: 'P1DT2H3M4S',
				live: 'PT0S', // live stream / zero => 0 (kept, not filtered)
				decimal: 'PT1M30.5S',
			};
			const ids = Object.keys(durations);
			mockYoutube([ids.map((id) => playlistItem({ id }))], durations);

			const result = await service.getPlaylistItems(PLAYLIST_URL);
			const byId = Object.fromEntries(
				(result ?? []).map((item) => [item.id, item.duration]),
			);

			expect(byId).toEqual({
				secs: 45,
				mins: 253,
				hours: 3730,
				days: 93784,
				live: 0,
				decimal: 90.5,
			});
		});
	});

	describe('getPlaylistItems - filtering & batching', () => {
		it('drops deleted/private videos that have no duration entry', async () => {
			mockYoutube(
				[[playlistItem({ id: 'keep' }), playlistItem({ id: 'gone' })]],
				{ keep: 'PT10S', gone: undefined },
			);

			const result = await service.getPlaylistItems(PLAYLIST_URL);

			expect(result).toHaveLength(1);
			expect(result![0]).toMatchObject({ id: 'keep', duration: 10 });
		});

		it('batches duration lookups into chunks of 50', async () => {
			const ids = Array.from({ length: 120 }, (_, i) => `v${i}`);
			const durations: Record<string, string> = {};
			for (const id of ids) {
				durations[id] = 'PT30S';
			}
			mockYoutube([ids.map((id) => playlistItem({ id }))], durations);

			const result = await service.getPlaylistItems(PLAYLIST_URL);

			expect(result).toHaveLength(120);
			expect(result!.every((item) => item.duration === 30)).toBe(true);

			const videoCalls = mockedGet.mock.calls.filter(([u]) =>
				String(u).endsWith('/videos'),
			);
			expect(videoCalls).toHaveLength(3); // ceil(120 / 50)
			expect(String(videoCalls[0][1].params.id).split(',')).toHaveLength(50);
			expect(String(videoCalls[1][1].params.id).split(',')).toHaveLength(50);
			expect(String(videoCalls[2][1].params.id).split(',')).toHaveLength(20);
		});
	});

	describe('getPlaylistItems - error handling', () => {
		it('returns null when the playlistItems request throws', async () => {
			mockedGet.mockRejectedValue(new Error('network down'));

			const result = await service.getPlaylistItems(PLAYLIST_URL);

			expect(result).toBeNull();
		});

		it('returns null when the durations lookup fails for every video', async () => {
			// A total durations failure must be distinguishable from an empty
			// playlist, so the method returns null rather than an empty array.
			mockedGet.mockImplementation((url: string) => {
				if (url.endsWith('/playlistItems')) {
					return Promise.resolve({
						data: {
							items: [playlistItem({ id: 'a' }), playlistItem({ id: 'b' })],
							nextPageToken: undefined,
						},
					});
				}
				return Promise.reject(new Error('videos endpoint down'));
			});

			const result = await service.getPlaylistItems(PLAYLIST_URL);

			expect(result).toBeNull();
		});

		it('keeps songs (duration 0) when only some duration batches fail', async () => {
			const ids = Array.from({ length: 60 }, (_, i) => `v${i}`);
			let videoCall = 0;
			mockedGet.mockImplementation(
				(url: string, config: { params?: any } = {}) => {
					if (url.endsWith('/playlistItems')) {
						return Promise.resolve({
							data: {
								items: ids.map((id) => playlistItem({ id })),
								nextPageToken: undefined,
							},
						});
					}
					if (url.endsWith('/videos')) {
						videoCall += 1;
						// Fail only the second batch (ids v50..v59).
						if (videoCall === 2) {
							return Promise.reject(new Error('second batch down'));
						}
						const chunkIds = String(config.params.id).split(',');
						return Promise.resolve({
							data: {
								items: chunkIds.map((id) => ({
									id,
									contentDetails: { duration: 'PT30S' },
								})),
							},
						});
					}
					return Promise.reject(new Error(`unexpected url: ${url}`));
				},
			);

			const result = await service.getPlaylistItems(PLAYLIST_URL);

			// Nothing is dropped on a transient batch failure.
			expect(result).toHaveLength(60);
			const unknown = result!.filter((item) => item.duration === 0);
			expect(unknown).toHaveLength(10);
		});
	});
});
