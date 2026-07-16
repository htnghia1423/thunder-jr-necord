import type { Song } from 'distube';

import { DuplicateUtils } from './duplicate.utils';

const song = (
	over: Partial<{ url: string; name: string; uploader: string }> = {},
): Song =>
	({
		url: over.url ?? 'https://example.com/1',
		name: over.name ?? 'Song 1',
		uploader: { name: over.uploader ?? 'Artist 1' },
	}) as unknown as Song;

describe('DuplicateUtils.checkDuplicate', () => {
	it('returns not-duplicate for an empty queue', () => {
		expect(DuplicateUtils.checkDuplicate(song(), [])).toEqual({
			isDuplicate: false,
		});
	});

	it('flags an exact URL + name/uploader match as "both" with a 1-based position', () => {
		const existing = [song({ url: 'https://a', name: 'A', uploader: 'U' })];
		expect(
			DuplicateUtils.checkDuplicate(
				song({ url: 'https://a', name: 'A', uploader: 'U' }),
				existing,
			),
		).toEqual({ isDuplicate: true, position: 1, matchType: 'both' });
	});

	it('flags a URL-only match', () => {
		const existing = [song({ url: 'https://a', name: 'A', uploader: 'U' })];
		expect(
			DuplicateUtils.checkDuplicate(
				song({ url: 'https://a', name: 'Different', uploader: 'Other' }),
				existing,
			),
		).toEqual({ isDuplicate: true, position: 1, matchType: 'url' });
	});

	it('flags a case-insensitive name + uploader match on a different URL', () => {
		const existing = [song({ url: 'https://a', name: 'A', uploader: 'U' })];
		expect(
			DuplicateUtils.checkDuplicate(
				song({ url: 'https://b', name: 'a', uploader: 'u' }),
				existing,
			),
		).toEqual({ isDuplicate: true, position: 1, matchType: 'name' });
	});

	it('returns not-duplicate when nothing matches', () => {
		const existing = [song({ url: 'https://a', name: 'A', uploader: 'U' })];
		expect(
			DuplicateUtils.checkDuplicate(
				song({ url: 'https://z', name: 'Z', uploader: 'Zz' }),
				existing,
			).isDuplicate,
		).toBe(false);
	});
});

describe('DuplicateUtils.checkPlaylistDuplicates', () => {
	it('separates duplicates from new songs and counts them', () => {
		const existing = [song({ url: 'https://a', name: 'A', uploader: 'U' })];
		const result = DuplicateUtils.checkPlaylistDuplicates(
			[
				song({ url: 'https://a', name: 'A', uploader: 'U' }),
				song({ url: 'https://b', name: 'B', uploader: 'U2' }),
			],
			existing,
		);

		expect(result.totalSongs).toBe(2);
		expect(result.duplicateCount).toBe(1);
		expect(result.newSongs).toHaveLength(1);
		expect(result.newSongs[0].url).toBe('https://b');
		expect(result.duplicates[0].existingPosition).toBe(1);
	});
});

describe('DuplicateUtils message builders', () => {
	it('builds a single-song duplicate warning', () => {
		const message = DuplicateUtils.generateDuplicateWarning('Song', 3, 'url');
		expect(message).toContain('#3');
		expect(message).toContain('same URL');
	});

	it('builds a playlist duplicate summary with percentage and examples', () => {
		const message = DuplicateUtils.generatePlaylistDuplicateMessage(4, 1, [
			{
				song: song({ name: 'Dup Song' }),
				existingPosition: 2,
				matchType: 'url',
			},
		]);

		expect(message).toContain('1 duplicates out of 4 songs');
		expect(message).toContain('(25%)');
		expect(message).toContain('Dup Song');
		expect(message).toContain('#2');
	});
});
