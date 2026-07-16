import { Logger } from '@nestjs/common';

import { PlaylistOptimizationService } from './playlist-optimization.service';

describe('PlaylistOptimizationService', () => {
	let service: PlaylistOptimizationService;

	beforeAll(() => {
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	});

	beforeEach(() => {
		service = new PlaylistOptimizationService();
	});

	describe('isYouTubeStandardPlaylist', () => {
		it('returns false when the query is not a youtube.com url', () => {
			expect(
				service.isYouTubeStandardPlaylist(
					'https://soundcloud.com/x?list=PLabc',
				),
			).toBe(false);
		});

		it('returns false when there is no list parameter', () => {
			expect(
				service.isYouTubeStandardPlaylist(
					'https://www.youtube.com/watch?v=abc123',
				),
			).toBe(false);
		});

		it('returns true for a standard PL playlist url', () => {
			expect(
				service.isYouTubeStandardPlaylist(
					'https://www.youtube.com/playlist?list=PLabc123',
				),
			).toBe(true);
		});

		it('returns true for a watch url carrying a standard UU list parameter', () => {
			expect(
				service.isYouTubeStandardPlaylist(
					'https://www.youtube.com/watch?v=abc&list=UUchannel',
				),
			).toBe(true);
		});

		it('returns false for a YouTube Mix (RD prefix)', () => {
			expect(
				service.isYouTubeStandardPlaylist(
					'https://www.youtube.com/watch?v=abc&list=RDabc',
				),
			).toBe(false);
		});

		it('returns false for a radio Mix (RDMM prefix)', () => {
			expect(
				service.isYouTubeStandardPlaylist(
					'https://www.youtube.com/watch?v=abc&list=RDMMabc',
				),
			).toBe(false);
		});

		it('returns false when the list parameter is present but empty', () => {
			expect(
				service.isYouTubeStandardPlaylist(
					'https://www.youtube.com/watch?v=abc&list=',
				),
			).toBe(false);
		});
	});

	describe('stripMixParameters', () => {
		it('keeps only the video id and drops list / radio params', () => {
			expect(
				service.stripMixParameters(
					'https://www.youtube.com/watch?v=VIDEO123&list=RDVIDEO123&start_radio=1',
				),
			).toBe('https://www.youtube.com/watch?v=VIDEO123');
		});

		it('returns the original url when there is no video id', () => {
			const url = 'https://www.youtube.com/playlist?list=PLabc';
			expect(service.stripMixParameters(url)).toBe(url);
		});

		it('returns the original string when the url cannot be parsed', () => {
			expect(service.stripMixParameters('not-a-valid-url')).toBe(
				'not-a-valid-url',
			);
		});
	});

	describe('shouldOptimizePlaylist', () => {
		it('delegates to isYouTubeStandardPlaylist and returns true for a standard playlist', () => {
			expect(
				service.shouldOptimizePlaylist(
					'https://www.youtube.com/playlist?list=PLabc',
				),
			).toBe(true);
		});

		it('delegates to isYouTubeStandardPlaylist and returns false for a Mix', () => {
			expect(
				service.shouldOptimizePlaylist(
					'https://www.youtube.com/watch?v=abc&list=RDabc',
				),
			).toBe(false);
		});
	});
});
