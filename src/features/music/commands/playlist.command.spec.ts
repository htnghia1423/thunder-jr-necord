import { Logger } from '@nestjs/common';
import { createMockInteraction } from '@test/helpers/discord';
import { MessageFlags } from 'discord.js';

import { PlaylistCommand } from './playlist.command';

jest.mock('../services/music.service', () => ({
	MusicService: class {},
}));
jest.mock('../services/distube.service', () => ({
	DisTubeService: class {},
}));
jest.mock('../services/playlist-storage.service', () => ({
	PlaylistStorageService: class {},
}));

const makeInteraction = (options: Record<string, unknown> = {}): any => {
	const interaction = createMockInteraction(options);
	interaction.isChatInputCommand = jest.fn().mockReturnValue(true);
	return interaction;
};

const buildSong = (overrides: Record<string, unknown> = {}): any => ({
	name: 'Test Song',
	url: 'https://youtu.be/test',
	duration: 194,
	thumbnail: 'https://img/thumb.jpg',
	uploader: { name: 'Test Uploader' },
	...overrides,
});

describe('PlaylistCommand', () => {
	let distubeService: any;
	let playlistStorageService: any;
	let musicService: any;
	let command: PlaylistCommand;

	beforeEach(() => {
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		distubeService = { getDistube: jest.fn() };
		playlistStorageService = {
			savePlaylist: jest.fn(),
			loadPlaylist: jest.fn(),
			getUserPlaylists: jest.fn(),
			deletePlaylist: jest.fn(),
		};
		musicService = { play: jest.fn() };
		command = new PlaylistCommand(
			distubeService as any,
			playlistStorageService as any,
			musicService as any,
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('save', () => {
		it('saves the current queue and replies with a saved embed', async () => {
			const interaction = makeInteraction();
			const queue = {
				songs: [
					buildSong({ name: 'S1', url: 'u1' }),
					buildSong({ name: 'S2', url: 'u2' }),
				],
			};
			distubeService.getDistube.mockReturnValue({
				getQueue: jest.fn().mockReturnValue(queue),
			});
			playlistStorageService.savePlaylist.mockResolvedValue(undefined);

			await command.save([interaction] as any, { name: 'MyList' } as any);

			expect(interaction.deferReply).toHaveBeenCalledWith({
				flags: MessageFlags.Ephemeral,
			});
			expect(playlistStorageService.savePlaylist).toHaveBeenCalledTimes(1);
			const arg = playlistStorageService.savePlaylist.mock.calls[0][0];
			expect(arg.playlistName).toBe('MyList');
			expect(arg.userId).toBe('user-1');
			expect(arg.songs).toHaveLength(2);
			expect(arg.songs[0]).toMatchObject({ title: 'S1', url: 'u1' });
			const payload = interaction.editReply.mock.calls.at(-1)[0];
			expect(payload.embeds[0].data.title).toBe('💾 Playlist Saved');
		});

		it('rejects saving when the user is not in a voice channel', async () => {
			const interaction = makeInteraction({ voiceChannelId: null });

			await command.save([interaction] as any, { name: 'X' } as any);

			expect(playlistStorageService.savePlaylist).not.toHaveBeenCalled();
			const payload = interaction.editReply.mock.calls[0][0];
			expect(payload.embeds[0].data.title).toBe('❌ Error');
		});

		it('rejects saving when the queue is empty', async () => {
			const interaction = makeInteraction();
			distubeService.getDistube.mockReturnValue({
				getQueue: jest.fn().mockReturnValue({ songs: [] }),
			});

			await command.save([interaction] as any, { name: 'X' } as any);

			expect(playlistStorageService.savePlaylist).not.toHaveBeenCalled();
			const payload = interaction.editReply.mock.calls[0][0];
			expect(payload.embeds[0].data.description).toContain('No queue');
		});

		it('replies with an error embed when saving throws', async () => {
			const interaction = makeInteraction();
			distubeService.getDistube.mockReturnValue({
				getQueue: jest.fn().mockReturnValue({ songs: [buildSong()] }),
			});
			playlistStorageService.savePlaylist.mockRejectedValue(
				new Error('db fail'),
			);

			await command.save([interaction] as any, { name: 'X' } as any);

			const payload = interaction.editReply.mock.calls.at(-1)[0];
			expect(payload.embeds[0].data.description).toContain(
				'Failed to save playlist',
			);
		});
	});

	describe('load', () => {
		it('rejects loading when the user is not in a voice channel', async () => {
			const interaction = makeInteraction({ voiceChannelId: null });

			await command.load([interaction] as any, { name: 'X' } as any);

			expect(playlistStorageService.loadPlaylist).not.toHaveBeenCalled();
			const payload = interaction.editReply.mock.calls[0][0];
			expect(payload.embeds[0].data.title).toBe('❌ Error');
		});

		it('replies with an error embed when the playlist does not exist', async () => {
			const interaction = makeInteraction();
			playlistStorageService.loadPlaylist.mockResolvedValue(null);

			await command.load([interaction] as any, { name: 'Missing' } as any);

			expect(playlistStorageService.loadPlaylist).toHaveBeenCalledWith(
				'user-1',
				'Missing',
			);
			expect(musicService.play).not.toHaveBeenCalled();
			const payload = interaction.editReply.mock.calls[0][0];
			expect(payload.embeds[0].data.description).toContain('Missing');
		});

		it('loads each stored song into the queue and reports progress', async () => {
			jest.useFakeTimers();
			const interaction = makeInteraction();
			playlistStorageService.loadPlaylist.mockResolvedValue({
				songs: [{ title: 'Song 1', url: 'https://song-1' }],
			});
			musicService.play.mockResolvedValue({ success: true, message: 'ok' });

			const promise = command.load(
				[interaction] as any,
				{ name: 'RoadTrip' } as any,
			);
			await jest.runAllTimersAsync();
			await promise;
			jest.useRealTimers();

			expect(playlistStorageService.loadPlaylist).toHaveBeenCalledWith(
				'user-1',
				'RoadTrip',
			);
			expect(musicService.play).toHaveBeenCalledWith(
				interaction,
				'https://song-1',
			);
			const finalPayload = interaction.editReply.mock.calls.at(-1)[0];
			expect(finalPayload.content).toContain('Loaded playlist **RoadTrip**');
			expect(finalPayload.content).toContain('Added: **1/1**');
		});
	});

	describe('list', () => {
		it('replies with the playlists embed', async () => {
			const interaction = makeInteraction();
			playlistStorageService.getUserPlaylists.mockResolvedValue([
				{
					name: 'Chill',
					songs: [buildSong(), buildSong()],
					updatedAt: new Date('2026-01-01'),
				},
			]);

			await command.list([interaction] as any);

			expect(interaction.deferReply).toHaveBeenCalledWith({
				flags: MessageFlags.Ephemeral,
			});
			expect(playlistStorageService.getUserPlaylists).toHaveBeenCalledWith(
				'user-1',
			);
			const payload = interaction.editReply.mock.calls[0][0];
			expect(payload.embeds[0].data.title).toContain('Playlists');
			expect(payload.embeds[0].data.description).toContain('Chill');
		});

		it('replies with an error embed when listing fails', async () => {
			const interaction = makeInteraction();
			playlistStorageService.getUserPlaylists.mockRejectedValue(
				new Error('db'),
			);

			await command.list([interaction] as any);

			const payload = interaction.editReply.mock.calls[0][0];
			expect(payload.embeds[0].data.description).toContain(
				'Failed to load playlists',
			);
		});
	});

	describe('delete', () => {
		it('deletes an existing playlist', async () => {
			const interaction = makeInteraction();
			playlistStorageService.deletePlaylist.mockResolvedValue(true);

			await command.delete([interaction] as any, { name: 'Old' } as any);

			expect(playlistStorageService.deletePlaylist).toHaveBeenCalledWith(
				'user-1',
				'Old',
			);
			const payload = interaction.editReply.mock.calls[0][0];
			expect(payload.embeds[0].data.title).toBe('🗑️ Playlist Deleted');
		});

		it('replies with an error embed when the playlist does not exist', async () => {
			const interaction = makeInteraction();
			playlistStorageService.deletePlaylist.mockResolvedValue(false);

			await command.delete([interaction] as any, { name: 'Ghost' } as any);

			const payload = interaction.editReply.mock.calls[0][0];
			expect(payload.embeds[0].data.title).toBe('❌ Error');
			expect(payload.embeds[0].data.description).toContain('Ghost');
		});
	});
});
