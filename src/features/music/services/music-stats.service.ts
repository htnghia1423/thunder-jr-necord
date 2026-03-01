import { PrismaService } from '../../../prisma/prisma.service';
import type { ServerStatsData, TopSong, UserStatsData } from '../dto/stats.dto';
import { Injectable, Logger } from '@nestjs/common';
import type { Song } from 'distube';

/**
 * Service for tracking and retrieving music playback statistics
 * Handles recording song plays and aggregating statistics for servers and users
 */
@Injectable()
export class MusicStatsService {
	private readonly logger = new Logger(MusicStatsService.name);

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Record a song play in the database
	 * Called automatically when DisTube plays a song
	 *
	 * @param guildId - Discord guild/server ID
	 * @param userId - Discord user ID who requested the song
	 * @param song - DisTube song object with metadata
	 */
	async recordPlay(guildId: string, userId: string, song: Song): Promise<void> {
		try {
			await this.prisma.musicHistory.create({
				data: {
					guildId,
					userId,
					songTitle: song.name || 'Unknown',
					songUrl: song.url || '',
				},
			});

			this.logger.debug(
				`Recorded play: "${song.name}" by user ${userId} in guild ${guildId}`,
			);
		} catch (error) {
			this.logger.error(
				`Failed to record play for song "${song.name}":`,
				error instanceof Error ? error.stack : error,
			);
			// Don't throw - we don't want to break playback if stats fail
		}
	}

	/**
	 * Get server-wide statistics
	 * Aggregates data for top songs and top DJs
	 *
	 * @param guildId - Discord guild/server ID
	 * @returns Server statistics with top 10 songs and top 5 DJs
	 */
	async getServerStats(guildId: string): Promise<ServerStatsData> {
		this.logger.log(`Fetching server stats for guild ${guildId}`);

		// Get total plays for the server
		const totalPlays = await this.prisma.musicHistory.count({
			where: { guildId },
		});

		// Get top 10 most played songs
		const topSongsRaw = await this.prisma.musicHistory.groupBy({
			by: ['songTitle', 'songUrl'],
			where: { guildId },
			_count: {
				id: true,
			},
			orderBy: {
				_count: {
					id: 'desc',
				},
			},
			take: 10,
		});

		const topSongs: TopSong[] = topSongsRaw.map((entry) => ({
			songTitle: entry.songTitle,
			songUrl: entry.songUrl,
			playCount: entry._count.id,
		}));

		// Get top 5 DJs (users with most plays)
		const topDJsRaw = await this.prisma.musicHistory.groupBy({
			by: ['userId'],
			where: { guildId },
			_count: {
				id: true,
			},
			orderBy: {
				_count: {
					id: 'desc',
				},
			},
			take: 5,
		});

		// Note: Username resolution happens in the command layer
		// This service returns userId only - command will fetch usernames from Discord API
		const topDJs = topDJsRaw.map((entry) => ({
			userId: entry.userId,
			username: '', // Will be populated by command
			playCount: entry._count.id,
		}));

		this.logger.log(
			`Server stats: ${totalPlays} total plays, ${topSongs.length} top songs, ${topDJs.length} top DJs`,
		);

		return {
			guildId,
			totalPlays,
			topSongs,
			topDJs,
		};
	}

	/**
	 * Get user-specific statistics within a guild
	 * Shows user's personal listening history and rank
	 *
	 * @param guildId - Discord guild/server ID
	 * @param userId - Discord user ID
	 * @returns User statistics with top 10 favorite songs and rank
	 */
	async getUserStats(guildId: string, userId: string): Promise<UserStatsData> {
		this.logger.log(`Fetching user stats for ${userId} in guild ${guildId}`);

		// Get total plays for the user in this guild
		const totalPlays = await this.prisma.musicHistory.count({
			where: { guildId, userId },
		});

		// Get user's top 10 favorite songs
		const topSongsRaw = await this.prisma.musicHistory.groupBy({
			by: ['songTitle', 'songUrl'],
			where: { guildId, userId },
			_count: {
				id: true,
			},
			orderBy: {
				_count: {
					id: 'desc',
				},
			},
			take: 10,
		});

		const topSongs: TopSong[] = topSongsRaw.map((entry) => ({
			songTitle: entry.songTitle,
			songUrl: entry.songUrl,
			playCount: entry._count.id,
		}));

		// Calculate user's rank in the server
		// Get all users sorted by play count, then find this user's position
		const allUsersRaw = await this.prisma.musicHistory.groupBy({
			by: ['userId'],
			where: { guildId },
			_count: {
				id: true,
			},
			orderBy: {
				_count: {
					id: 'desc',
				},
			},
		});

		const rank = allUsersRaw.findIndex((entry) => entry.userId === userId) + 1;

		this.logger.log(
			`User stats: ${totalPlays} plays, ${topSongs.length} top songs, rank #${rank}`,
		);

		return {
			guildId,
			userId,
			totalPlays,
			topSongs,
			rank: rank > 0 ? rank : undefined, // undefined if user has no plays
		};
	}
}
