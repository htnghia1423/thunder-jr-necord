import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Song } from 'distube';

import { PrismaService } from '@/prisma/prisma.service';

import { MusicStatsService } from './music-stats.service';

interface PrismaMock {
	musicHistory: {
		create: jest.Mock;
		count: jest.Mock;
		groupBy: jest.Mock;
	};
}

const song = (over: Partial<Song> = {}): Song =>
	({ name: 'Song', url: 'https://song', ...over }) as unknown as Song;

describe('MusicStatsService', () => {
	let service: MusicStatsService;
	let prisma: PrismaMock;

	beforeAll(() => {
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterAll(() => {
		jest.restoreAllMocks();
	});

	beforeEach(async () => {
		prisma = {
			musicHistory: {
				create: jest.fn(),
				count: jest.fn(),
				groupBy: jest.fn(),
			},
		};

		const moduleRef = await Test.createTestingModule({
			providers: [
				MusicStatsService,
				{ provide: PrismaService, useValue: prisma },
			],
		}).compile();

		service = moduleRef.get(MusicStatsService);
	});

	describe('recordPlay', () => {
		it('persists the play using the song title and url', async () => {
			prisma.musicHistory.create.mockResolvedValue({});

			await service.recordPlay(
				'g1',
				'u1',
				song({ name: 'Song A', url: 'http://a' }),
			);

			expect(prisma.musicHistory.create).toHaveBeenCalledWith({
				data: {
					guildId: 'g1',
					userId: 'u1',
					songTitle: 'Song A',
					songUrl: 'http://a',
				},
			});
		});

		it('falls back to "Unknown" title and empty url when the song lacks metadata', async () => {
			prisma.musicHistory.create.mockResolvedValue({});

			await service.recordPlay(
				'g1',
				'u1',
				song({ name: undefined, url: undefined }),
			);

			expect(prisma.musicHistory.create).toHaveBeenCalledWith({
				data: {
					guildId: 'g1',
					userId: 'u1',
					songTitle: 'Unknown',
					songUrl: '',
				},
			});
		});

		it('swallows database errors so playback is never interrupted', async () => {
			prisma.musicHistory.create.mockRejectedValue(new Error('db down'));

			await expect(
				service.recordPlay('g1', 'u1', song()),
			).resolves.toBeUndefined();
		});
	});

	describe('getServerStats', () => {
		it('aggregates total plays, top songs and top DJs for a guild', async () => {
			prisma.musicHistory.count.mockResolvedValue(42);
			prisma.musicHistory.groupBy
				.mockResolvedValueOnce([
					{ songTitle: 'A', songUrl: 'ua', _count: { id: 10 } },
					{ songTitle: 'B', songUrl: 'ub', _count: { id: 5 } },
				])
				.mockResolvedValueOnce([
					{ userId: 'dj1', _count: { id: 8 } },
					{ userId: 'dj2', _count: { id: 3 } },
				]);

			const result = await service.getServerStats('g1');

			expect(result).toEqual({
				guildId: 'g1',
				totalPlays: 42,
				topSongs: [
					{ songTitle: 'A', songUrl: 'ua', playCount: 10 },
					{ songTitle: 'B', songUrl: 'ub', playCount: 5 },
				],
				topDJs: [
					{ userId: 'dj1', username: '', playCount: 8 },
					{ userId: 'dj2', username: '', playCount: 3 },
				],
			});
		});

		it('scopes every query to the guild and requests the top 10 songs / top 5 DJs', async () => {
			prisma.musicHistory.count.mockResolvedValue(0);
			prisma.musicHistory.groupBy
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]);

			await service.getServerStats('guild-xyz');

			expect(prisma.musicHistory.count).toHaveBeenCalledWith({
				where: { guildId: 'guild-xyz' },
			});
			expect(prisma.musicHistory.groupBy).toHaveBeenNthCalledWith(1, {
				by: ['songTitle', 'songUrl'],
				where: { guildId: 'guild-xyz' },
				_count: { id: true },
				orderBy: { _count: { id: 'desc' } },
				take: 10,
			});
			expect(prisma.musicHistory.groupBy).toHaveBeenNthCalledWith(2, {
				by: ['userId'],
				where: { guildId: 'guild-xyz' },
				_count: { id: true },
				orderBy: { _count: { id: 'desc' } },
				take: 5,
			});
		});
	});

	describe('getUserStats', () => {
		it('returns the user favourites and 1-based rank within the guild', async () => {
			prisma.musicHistory.count.mockResolvedValue(12);
			prisma.musicHistory.groupBy
				.mockResolvedValueOnce([
					{ songTitle: 'Fav', songUrl: 'uf', _count: { id: 9 } },
				])
				.mockResolvedValueOnce([
					{ userId: 'other', _count: { id: 20 } },
					{ userId: 'me', _count: { id: 12 } },
					{ userId: 'z', _count: { id: 1 } },
				]);

			const result = await service.getUserStats('g1', 'me');

			expect(result).toEqual({
				guildId: 'g1',
				userId: 'me',
				totalPlays: 12,
				topSongs: [{ songTitle: 'Fav', songUrl: 'uf', playCount: 9 }],
				rank: 2, // index 1 in the ranking + 1
			});
		});

		it('filters the user queries by userId but ranks across the whole guild', async () => {
			prisma.musicHistory.count.mockResolvedValue(3);
			prisma.musicHistory.groupBy
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([{ userId: 'me', _count: { id: 3 } }]);

			await service.getUserStats('g1', 'me');

			expect(prisma.musicHistory.count).toHaveBeenCalledWith({
				where: { guildId: 'g1', userId: 'me' },
			});
			// favourite songs are user-scoped
			expect(prisma.musicHistory.groupBy).toHaveBeenNthCalledWith(1, {
				by: ['songTitle', 'songUrl'],
				where: { guildId: 'g1', userId: 'me' },
				_count: { id: true },
				orderBy: { _count: { id: 'desc' } },
				take: 10,
			});
			// ranking is guild-wide (no userId filter, no take)
			expect(prisma.musicHistory.groupBy).toHaveBeenNthCalledWith(2, {
				by: ['userId'],
				where: { guildId: 'g1' },
				_count: { id: true },
				orderBy: { _count: { id: 'desc' } },
			});
		});

		it('returns an undefined rank when the user has no plays', async () => {
			prisma.musicHistory.count.mockResolvedValue(0);
			prisma.musicHistory.groupBy
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([{ userId: 'someone-else', _count: { id: 5 } }]);

			const result = await service.getUserStats('g1', 'ghost');

			expect(result.rank).toBeUndefined();
			expect(result.totalPlays).toBe(0);
			expect(result.topSongs).toEqual([]);
		});
	});
});
