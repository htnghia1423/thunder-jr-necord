import { Logger } from '@nestjs/common';

import { LyricsNotFoundError, LyricsService } from './lyrics.service';

const makeResponse = (status: number, body: unknown, ok?: boolean): any => ({
	ok: ok ?? (status >= 200 && status < 300),
	status,
	json: async () => body,
});

const track = (over: Record<string, any> = {}) => ({
	id: 1,
	trackName: 'Track',
	artistName: 'Artist',
	albumName: null,
	duration: 200,
	plainLyrics: 'la la la',
	syncedLyrics: null,
	...over,
});

describe('LyricsService', () => {
	let service: LyricsService;
	let fetchMock: jest.Mock;
	const originalFetch = global.fetch;

	beforeAll(() => {
		// Silence Nest logging so test output stays readable.
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterAll(() => {
		jest.restoreAllMocks();
		global.fetch = originalFetch;
	});

	beforeEach(() => {
		// Fresh instance per test avoids the internal lyrics cache leaking across tests.
		service = new LyricsService();
		fetchMock = jest.fn();
		global.fetch = fetchMock;
	});

	describe('getLyrics', () => {
		it('resolves a direct "Artist - Title" hit via /api/get', async () => {
			fetchMock.mockImplementation((url: string) => {
				if (url.includes('/api/get')) {
					return Promise.resolve(
						makeResponse(
							200,
							track({
								trackName: 'Bohemian Rhapsody',
								artistName: 'Queen',
								plainLyrics: 'Is this the real life?',
							}),
						),
					);
				}
				throw new Error(`unexpected url: ${url}`);
			});

			const result = await service.getLyrics('Queen - Bohemian Rhapsody');

			expect(result).toEqual({
				title: 'Bohemian Rhapsody',
				artist: 'Queen',
				lyrics: 'Is this the real life?',
			});
			expect(fetchMock).toHaveBeenCalledTimes(1);
			const calledUrl = fetchMock.mock.calls[0][0] as string;
			expect(calledUrl).toContain('/api/get');
			expect(calledUrl).toContain('artist_name=Queen');
			expect(calledUrl).toContain('track_name=Bohemian');
		});

		it('falls back to /api/search when the query has no artist separator', async () => {
			fetchMock.mockImplementation((url: string) => {
				if (url.includes('/api/search')) {
					return Promise.resolve(
						makeResponse(200, [
							track({
								trackName: 'Imagine',
								artistName: 'John Lennon',
								plainLyrics: 'Imagine all the people',
							}),
						]),
					);
				}
				throw new Error(`unexpected url: ${url}`);
			});

			const result = await service.getLyrics('Imagine');

			expect(result.title).toBe('Imagine');
			expect(result.artist).toBe('John Lennon');
			expect(result.lyrics).toBe('Imagine all the people');
			const calledUrl = fetchMock.mock.calls[0][0] as string;
			expect(calledUrl).toContain('/api/search');
			expect(calledUrl).toContain('q=Imagine');
		});

		it('falls back to /api/search when the direct /api/get lookup returns 404', async () => {
			fetchMock.mockImplementation((url: string) => {
				if (url.includes('/api/search')) {
					return Promise.resolve(
						makeResponse(200, [
							track({
								trackName: 'Yesterday',
								artistName: 'The Beatles',
								plainLyrics: 'Yesterday, all my troubles seemed so far away',
							}),
						]),
					);
				}
				return Promise.resolve(makeResponse(404, {}, false));
			});

			const result = await service.getLyrics('The Beatles - Yesterday');

			expect(result.title).toBe('Yesterday');
			expect(fetchMock).toHaveBeenCalledTimes(2);
			const urls = fetchMock.mock.calls.map((call) => call[0] as string);
			expect(urls[0]).toContain('/api/get');
			expect(urls[1]).toContain('/api/search');
		});

		it('bolds bracketed section headers in the returned lyrics', async () => {
			fetchMock.mockImplementation((url: string) => {
				if (url.includes('/api/get')) {
					return Promise.resolve(
						makeResponse(
							200,
							track({
								trackName: 'Song',
								artistName: 'Band',
								plainLyrics: '[Verse 1]\nHello world',
							}),
						),
					);
				}
				throw new Error(`unexpected url: ${url}`);
			});

			const result = await service.getLyrics('Band - Song');

			expect(result.lyrics).toBe('**[Verse 1]**\nHello world');
		});

		it('throws LyricsNotFoundError when the search returns no results', async () => {
			fetchMock.mockResolvedValue(makeResponse(200, []));

			const error = await service
				.getLyrics('Nonexistent Xyz Song')
				.catch((err: unknown) => err);

			expect(error).toBeInstanceOf(LyricsNotFoundError);
			expect((error as LyricsNotFoundError).userMessage).toContain(
				'Nonexistent Xyz Song',
			);
		});

		it('throws LyricsNotFoundError when a found track has no plain lyrics', async () => {
			fetchMock.mockImplementation((url: string) => {
				if (url.includes('/api/get')) {
					return Promise.resolve(
						makeResponse(
							200,
							track({
								trackName: 'Instrumental',
								artistName: 'Composer',
								plainLyrics: null,
							}),
						),
					);
				}
				throw new Error(`unexpected url: ${url}`);
			});

			const error = await service
				.getLyrics('Composer - Instrumental')
				.catch((err: unknown) => err);

			expect(error).toBeInstanceOf(LyricsNotFoundError);
			expect((error as LyricsNotFoundError).userMessage).toContain(
				'Instrumental',
			);
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it('throws a descriptive error on a non-404 HTTP failure', async () => {
			fetchMock.mockResolvedValue(makeResponse(500, {}, false));

			await expect(service.getLyrics('Some Query')).rejects.toThrow(/HTTP 500/);
		});

		it('wraps network failures in a friendly error', async () => {
			fetchMock.mockRejectedValue(new TypeError('network down'));

			await expect(service.getLyrics('Another Query')).rejects.toThrow(
				'Failed to fetch lyrics. Please try again later.',
			);
		});
	});

	describe('getLyricsForSong', () => {
		it('resolves a direct metadata hit using title and artist', async () => {
			fetchMock.mockImplementation((url: string) => {
				if (url.includes('/api/get')) {
					return Promise.resolve(
						makeResponse(
							200,
							track({
								trackName: 'Lose Yourself',
								artistName: 'Eminem',
								plainLyrics: 'Look, if you had one shot',
							}),
						),
					);
				}
				throw new Error(`unexpected url: ${url}`);
			});

			const result = await service.getLyricsForSong('Lose Yourself', 'Eminem');

			expect(result).toEqual({
				title: 'Lose Yourself',
				artist: 'Eminem',
				lyrics: 'Look, if you had one shot',
			});
			const calledUrl = fetchMock.mock.calls[0][0] as string;
			expect(calledUrl).toContain('/api/get');
			expect(calledUrl).toContain('artist_name=Eminem');
		});

		it('accepts a relevant search result when the direct lookup 404s', async () => {
			fetchMock.mockImplementation((url: string) => {
				if (url.includes('/api/search')) {
					return Promise.resolve(
						makeResponse(200, [
							track({
								trackName: 'Numb (Live)',
								artistName: 'Linkin Park',
								plainLyrics: "I'm tired of being what you want me to be",
							}),
						]),
					);
				}
				return Promise.resolve(makeResponse(404, {}, false));
			});

			const result = await service.getLyricsForSong('Numb', 'Linkin Park');

			expect(result.title).toBe('Numb (Live)');
			expect(result.lyrics).toContain('tired of being');
		});

		it('rejects an unreliable search result that does not match the title', async () => {
			fetchMock.mockImplementation((url: string) => {
				if (url.includes('/api/search')) {
					return Promise.resolve(
						makeResponse(200, [
							track({
								trackName: 'Completely Different XYZ',
								artistName: 'Other Artist',
								plainLyrics: 'nope',
							}),
						]),
					);
				}
				return Promise.resolve(makeResponse(404, {}, false));
			});

			const error = await service
				.getLyricsForSong('My Unique Title', 'My Artist')
				.catch((err: unknown) => err);

			expect(error).toBeInstanceOf(LyricsNotFoundError);
			expect((error as LyricsNotFoundError).userMessage).toContain(
				'did not match',
			);
		});
	});

	describe('splitLyricsIntoChunks', () => {
		it('returns a single chunk for short lyrics', () => {
			const lyrics = 'line one\nline two\nline three';

			const chunks = service.splitLyricsIntoChunks(lyrics);

			expect(chunks).toHaveLength(1);
			expect(chunks[0]).toBe(lyrics);
		});

		it('splits lines into separate chunks when they exceed maxLength', () => {
			expect(service.splitLyricsIntoChunks('aaaa\nbbbb\ncccc', 5)).toEqual([
				'aaaa',
				'bbbb',
				'cccc',
			]);
		});

		it('groups consecutive lines up to maxLength', () => {
			expect(service.splitLyricsIntoChunks('ab\ncd\nefghij', 6)).toEqual([
				'ab\ncd',
				'efghij',
			]);
		});

		it('force-adds a single line that is longer than maxLength', () => {
			const chunks = service.splitLyricsIntoChunks('abcdefghij', 5);

			expect(chunks).toEqual(['abcdefghij']);
			expect(chunks[0].length).toBeGreaterThan(5);
		});

		it('guarantees at least one chunk for empty input', () => {
			const chunks = service.splitLyricsIntoChunks('');

			expect(chunks).toHaveLength(1);
			expect(chunks[0]).toBe('');
		});
	});
});
