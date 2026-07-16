import type { PlaylistSaveData, SavedPlaylist } from '../dto/playlist.dto';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '@/prisma/prisma.service';

import { PlaylistStorageService } from './playlist-storage.service';

interface PrismaMock {
	user: { upsert: jest.Mock };
	playlist: {
		deleteMany: jest.Mock;
		create: jest.Mock;
		findFirst: jest.Mock;
		findMany: jest.Mock;
		count: jest.Mock;
	};
}

const savedPlaylist = (over: Partial<SavedPlaylist> = {}): SavedPlaylist => ({
	id: 1,
	userId: 'u1',
	name: 'My Mix',
	createdAt: new Date('2020-01-01T00:00:00Z'),
	updatedAt: new Date('2020-01-02T00:00:00Z'),
	songs: [],
	...over,
});

describe('PlaylistStorageService', () => {
	let service: PlaylistStorageService;
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
			user: { upsert: jest.fn() },
			playlist: {
				deleteMany: jest.fn(),
				create: jest.fn(),
				findFirst: jest.fn(),
				findMany: jest.fn(),
				count: jest.fn(),
			},
		};

		const moduleRef = await Test.createTestingModule({
			providers: [
				PlaylistStorageService,
				{ provide: PrismaService, useValue: prisma },
			],
		}).compile();

		service = moduleRef.get(PlaylistStorageService);
	});

	describe('savePlaylist', () => {
		const data: PlaylistSaveData = {
			userId: 'u1',
			username: 'User One',
			playlistName: 'My Mix',
			songs: [
				{
					title: 'S1',
					url: 'u1-song',
					duration: 100,
					thumbnail: 't1',
					uploader: 'up1',
				},
				{ title: 'S2', url: 'u2-song', duration: 200 },
			],
		};

		it('upserts the owner, wipes any same-named playlist, then recreates it with ordered songs', async () => {
			const created = savedPlaylist({
				songs: [
					{
						id: 1,
						playlistId: 1,
						title: 'S1',
						url: 'u1-song',
						duration: 100,
						thumbnail: 't1',
						uploader: 'up1',
						position: 0,
						createdAt: new Date('2020-01-01T00:00:00Z'),
					},
					{
						id: 2,
						playlistId: 1,
						title: 'S2',
						url: 'u2-song',
						duration: 200,
						thumbnail: null,
						uploader: null,
						position: 1,
						createdAt: new Date('2020-01-01T00:00:00Z'),
					},
				],
			});
			prisma.user.upsert.mockResolvedValue({});
			prisma.playlist.deleteMany.mockResolvedValue({ count: 0 });
			prisma.playlist.create.mockResolvedValue(created);

			const result = await service.savePlaylist(data);

			expect(result).toBe(created);

			expect(prisma.user.upsert).toHaveBeenCalledWith({
				where: { discordId: 'u1' },
				update: { username: 'User One' },
				create: { id: 'u1', discordId: 'u1', username: 'User One' },
			});

			// ownership + name scoped delete before recreate
			expect(prisma.playlist.deleteMany).toHaveBeenCalledWith({
				where: { user: { discordId: 'u1' }, name: 'My Mix' },
			});

			expect(prisma.playlist.create).toHaveBeenCalledWith({
				data: {
					user: { connect: { discordId: 'u1' } },
					name: 'My Mix',
					songs: {
						create: [
							{
								title: 'S1',
								url: 'u1-song',
								duration: 100,
								thumbnail: 't1',
								uploader: 'up1',
								position: 0,
							},
							{
								title: 'S2',
								url: 'u2-song',
								duration: 200,
								thumbnail: undefined,
								uploader: undefined,
								position: 1,
							},
						],
					},
				},
				include: { songs: { orderBy: { position: 'asc' } } },
			});
		});

		it('deletes existing before creating (overwrite semantics)', async () => {
			prisma.user.upsert.mockResolvedValue({});
			prisma.playlist.deleteMany.mockResolvedValue({ count: 1 });
			prisma.playlist.create.mockResolvedValue(savedPlaylist());

			await service.savePlaylist(data);

			const deleteOrder =
				prisma.playlist.deleteMany.mock.invocationCallOrder[0];
			const createOrder = prisma.playlist.create.mock.invocationCallOrder[0];
			expect(deleteOrder).toBeLessThan(createOrder);
		});
	});

	describe('loadPlaylist', () => {
		it('returns the playlist scoped to the owner with songs ordered by position', async () => {
			const playlist = savedPlaylist();
			prisma.playlist.findFirst.mockResolvedValue(playlist);

			const result = await service.loadPlaylist('u1', 'My Mix');

			expect(result).toBe(playlist);
			expect(prisma.playlist.findFirst).toHaveBeenCalledWith({
				where: { user: { discordId: 'u1' }, name: 'My Mix' },
				include: { songs: { orderBy: { position: 'asc' } } },
			});
		});

		it('returns null when no matching playlist exists for the user', async () => {
			prisma.playlist.findFirst.mockResolvedValue(null);

			const result = await service.loadPlaylist('u1', 'Missing');

			expect(result).toBeNull();
		});
	});

	describe('getUserPlaylists', () => {
		it('lists the user playlists newest-first with ordered songs', async () => {
			const playlists = [savedPlaylist({ id: 2 }), savedPlaylist({ id: 1 })];
			prisma.playlist.findMany.mockResolvedValue(playlists);

			const result = await service.getUserPlaylists('u1');

			expect(result).toBe(playlists);
			expect(prisma.playlist.findMany).toHaveBeenCalledWith({
				where: { user: { discordId: 'u1' } },
				include: { songs: { orderBy: { position: 'asc' } } },
				orderBy: { updatedAt: 'desc' },
			});
		});
	});

	describe('deletePlaylist', () => {
		it('returns true and scopes the delete to the owner when a row is removed', async () => {
			prisma.playlist.deleteMany.mockResolvedValue({ count: 1 });

			const result = await service.deletePlaylist('u1', 'My Mix');

			expect(result).toBe(true);
			expect(prisma.playlist.deleteMany).toHaveBeenCalledWith({
				where: { user: { discordId: 'u1' }, name: 'My Mix' },
			});
		});

		it('returns false when nothing was deleted', async () => {
			prisma.playlist.deleteMany.mockResolvedValue({ count: 0 });

			const result = await service.deletePlaylist('u1', 'My Mix');

			expect(result).toBe(false);
		});
	});

	describe('playlistExists', () => {
		it('returns true when the owner has a playlist with that name', async () => {
			prisma.playlist.count.mockResolvedValue(2);

			const result = await service.playlistExists('u1', 'My Mix');

			expect(result).toBe(true);
			expect(prisma.playlist.count).toHaveBeenCalledWith({
				where: { user: { discordId: 'u1' }, name: 'My Mix' },
			});
		});

		it('returns false when the count is zero', async () => {
			prisma.playlist.count.mockResolvedValue(0);

			const result = await service.playlistExists('u1', 'My Mix');

			expect(result).toBe(false);
		});
	});

	describe('getUserPlaylistCount', () => {
		it('returns the owner-scoped playlist count', async () => {
			prisma.playlist.count.mockResolvedValue(7);

			const result = await service.getUserPlaylistCount('u1');

			expect(result).toBe(7);
			expect(prisma.playlist.count).toHaveBeenCalledWith({
				where: { user: { discordId: 'u1' } },
			});
		});
	});
});
