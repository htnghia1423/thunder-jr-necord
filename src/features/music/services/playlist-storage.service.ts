import { PrismaService } from '../../../prisma/prisma.service';
import { type PlaylistSaveData, type SavedPlaylist } from '../dto/playlist.dto';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PlaylistStorageService {
	private readonly logger = new Logger(PlaylistStorageService.name);

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Save a playlist to the database
	 * If a playlist with the same name already exists, it will be overwritten
	 */
	async savePlaylist(data: PlaylistSaveData): Promise<SavedPlaylist> {
		const { userId, username, playlistName, songs } = data;

		this.logger.log(
			`Saving playlist "${playlistName}" for user ${username} (${userId}) with ${songs.length} songs`,
		);

		// Ensure user exists (upsert)
		await this.prisma.user.upsert({
			where: { discordId: userId },
			update: { username },
			create: { id: userId, discordId: userId, username },
		});

		// Delete existing playlist with same name (if exists)
		await this.prisma.playlist.deleteMany({
			where: {
				user: { discordId: userId },
				name: playlistName,
			},
		});

		// Create new playlist with songs
		const playlist = await this.prisma.playlist.create({
			data: {
				user: { connect: { discordId: userId } },
				name: playlistName,
				songs: {
					create: songs.map((song, index) => ({
						title: song.title,
						url: song.url,
						duration: song.duration,
						thumbnail: song.thumbnail,
						uploader: song.uploader,
						position: index,
					})),
				},
			},
			include: {
				songs: {
					orderBy: { position: 'asc' },
				},
			},
		});

		this.logger.log(
			`Successfully saved playlist "${playlistName}" with ${playlist.songs.length} songs`,
		);

		return playlist;
	}

	/**
	 * Load a playlist by name for a specific user
	 */
	async loadPlaylist(
		userId: string,
		playlistName: string,
	): Promise<SavedPlaylist | null> {
		this.logger.log(`Loading playlist "${playlistName}" for user ${userId}`);

		const playlist = await this.prisma.playlist.findFirst({
			where: {
				user: { discordId: userId },
				name: playlistName,
			},
			include: {
				songs: {
					orderBy: { position: 'asc' },
				},
			},
		});

		if (!playlist) {
			this.logger.warn(
				`Playlist "${playlistName}" not found for user ${userId}`,
			);
			return null;
		}

		this.logger.log(
			`Successfully loaded playlist "${playlistName}" with ${playlist.songs.length} songs`,
		);

		return playlist;
	}

	/**
	 * Get all playlists for a user
	 */
	async getUserPlaylists(userId: string): Promise<SavedPlaylist[]> {
		this.logger.log(`Fetching all playlists for user ${userId}`);

		const playlists = await this.prisma.playlist.findMany({
			where: { user: { discordId: userId } },
			include: {
				songs: {
					orderBy: { position: 'asc' },
				},
			},
			orderBy: { updatedAt: 'desc' },
		});

		this.logger.log(`Found ${playlists.length} playlists for user ${userId}`);

		return playlists;
	}

	/**
	 * Delete a playlist by name for a specific user
	 */
	async deletePlaylist(userId: string, playlistName: string): Promise<boolean> {
		this.logger.log(`Deleting playlist "${playlistName}" for user ${userId}`);

		const result = await this.prisma.playlist.deleteMany({
			where: {
				user: { discordId: userId },
				name: playlistName,
			},
		});

		if (result.count === 0) {
			this.logger.warn(
				`Playlist "${playlistName}" not found for user ${userId}`,
			);
			return false;
		}

		this.logger.log(
			`Successfully deleted playlist "${playlistName}" for user ${userId}`,
		);

		return true;
	}

	/**
	 * Check if a playlist exists for a user
	 */
	async playlistExists(userId: string, playlistName: string): Promise<boolean> {
		const count = await this.prisma.playlist.count({
			where: {
				user: { discordId: userId },
				name: playlistName,
			},
		});

		return count > 0;
	}

	/**
	 * Get playlist count for a user
	 */
	async getUserPlaylistCount(userId: string): Promise<number> {
		return this.prisma.playlist.count({
			where: { user: { discordId: userId } },
		});
	}
}
