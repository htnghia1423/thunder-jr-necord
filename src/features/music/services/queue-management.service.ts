import { MusicResponse } from '../enums/music.enum';
import {
	ExtendedQueue,
	ExtendedSong,
} from '../interfaces/distube-types.interface';
import {
	MusicOperationResult,
	QueueResult,
	SkipResult,
} from '../interfaces/music.interface';
import { DiscordUtils } from '../utils/discord.utils';
import { MusicValidationUtils } from '../utils/music-validation.utils';
import { Injectable, Logger } from '@nestjs/common';
import { ChatInputCommandInteraction } from 'discord.js';

import { DisTubeService } from './distube.service';

@Injectable()
export class QueueManagementService {
	private readonly logger = new Logger(QueueManagementService.name);

	constructor(private readonly distubeService: DisTubeService) {}

	/**
	 * Skip current song
	 */
	async skip(interaction: ChatInputCommandInteraction): Promise<SkipResult> {
		try {
			const validation = MusicValidationUtils.validateMusicCommand(
				interaction,
				this.distubeService.getDistube(),
			);

			if (!validation.success) {
				return {
					success: false,
					message: validation.message!,
				};
			}

			const { guildId, queue, distube } = validation.data!;

			try {
				const skippedSong = queue.songs[0];
				const songsCount = queue.songs.length;

				// If only 1 song, use stop instead of skip
				if (songsCount <= 1) {
					await distube.stop(guildId);

					const songName = DiscordUtils.formatSongName(
						skippedSong?.name || 'Unknown',
					);
					const skipMessage = `⏭️ **Skipped:** ${songName}\n⏹️ **Queue has ended**`;

					return {
						success: true,
						message: skipMessage,
						data: {
							skippedSong,
							nextSong: null,
							wasLastSong: true,
						},
					};
				}

				// If multiple songs, normal skip
				await distube.skip(guildId);

				// Create dynamic message with actual song name
				const songName = DiscordUtils.formatSongName(
					skippedSong?.name || 'Unknown',
				);
				const skipMessage = `⏭️ **Skipped:** ${songName}`;

				return {
					success: true,
					message: skipMessage,
					data: {
						skippedSong,
						nextSong: queue.songs.length > 1 ? queue.songs[1] : null,
						wasLastSong: false,
					},
				};
			} catch (skipError) {
				this.logger.error('Error skipping song', skipError);
				return {
					success: false,
					message: MusicResponse.SKIP_ERROR,
				};
			}
		} catch (error) {
			this.logger.error('Error in skip method', error);
			return {
				success: false,
				message: MusicResponse.GENERIC_ERROR,
			};
		}
	}

	/**
	 * Stop playback and clear queue
	 */
	async stop(
		interaction: ChatInputCommandInteraction,
	): Promise<MusicOperationResult> {
		try {
			const validation = MusicValidationUtils.validateMusicCommand(
				interaction,
				this.distubeService.getDistube(),
			);

			if (!validation.success) {
				return {
					success: false,
					message: validation.message!,
				};
			}

			const { guildId, distube } = validation.data!;

			try {
				await distube.stop(guildId);
				return {
					success: true,
					message: MusicResponse.PLAYBACK_STOPPED,
				};
			} catch (stopError) {
				this.logger.error('Error stopping playback', stopError);
				return {
					success: false,
					message: MusicResponse.GENERIC_ERROR,
				};
			}
		} catch (error) {
			this.logger.error('Error in stop method', error);
			return {
				success: false,
				message: MusicResponse.GENERIC_ERROR,
			};
		}
	}

	/**
	 * Get current queue information
	 */
	getQueue(interaction: ChatInputCommandInteraction): Promise<QueueResult> {
		return new Promise((resolve) => {
			try {
				const guildId = interaction.guildId;
				if (!guildId) {
					resolve({
						success: false,
						message: MusicResponse.GENERIC_ERROR,
					});
					return;
				}

				const distube = this.distubeService.getDistube();
				const queue = distube.getQueue(guildId) as ExtendedQueue | null;

				if (!queue) {
					resolve({
						success: false,
						message: MusicResponse.NO_QUEUE,
					});
					return;
				}

				const songs = queue.songs;
				if (!songs || songs.length === 0) {
					resolve({
						success: false,
						message: MusicResponse.QUEUE_EMPTY,
					});
					return;
				}

				const currentSong = songs[0];
				const queueList = songs.slice(1, 10); // Show first 9 upcoming songs

				let queueMessage = `🎵 **Now Playing:** ${DiscordUtils.formatSongName(currentSong.name || 'Unknown')}\n`;
				queueMessage += `⏱️ **Duration:** ${DiscordUtils.formatDuration(currentSong.formattedDuration || '00:00')}\n\n`;

				if (queueList.length > 0) {
					queueMessage += `📋 **Queue (${songs.length - 1} songs):**\n`;
					queueList.forEach((song, index: number) => {
						const safeSongName = DiscordUtils.formatSongName(
							song.name || 'Unknown',
						);
						const safeDuration = DiscordUtils.formatDuration(
							song.formattedDuration || '00:00',
						);
						queueMessage += `${index + 1}. ${safeSongName} - \`${safeDuration}\`\n`;
					});

					if (songs.length > 10) {
						queueMessage += `... and ${songs.length - 10} more songs\n`;
					}
				}

				resolve({
					success: true,
					message: queueMessage,
					data: {
						currentSong,
						queue: songs,
						queueLength: songs.length,
					},
				});
			} catch (error) {
				this.logger.error('Error in getQueue method', error);
				resolve({
					success: false,
					message: MusicResponse.GENERIC_ERROR,
				});
			}
		});
	}

	/**
	 * Get now playing information
	 */
	getNowPlaying(
		interaction: ChatInputCommandInteraction,
		createProgressBar: (currentTime: number, totalTime: number) => string,
	): Promise<QueueResult> {
		return new Promise((resolve) => {
			try {
				const guildId = interaction.guildId;
				if (!guildId) {
					resolve({
						success: false,
						message: MusicResponse.GENERIC_ERROR,
					});
					return;
				}

				const distube = this.distubeService.getDistube();
				const queue = distube.getQueue(guildId) as ExtendedQueue | null;

				if (!queue) {
					resolve({
						success: false,
						message: MusicResponse.NO_QUEUE,
					});
					return;
				}

				const currentSong = queue.songs[0];
				if (!currentSong) {
					resolve({
						success: false,
						message: MusicResponse.NO_CURRENT_SONG,
					});
					return;
				}

				const progress = queue.formattedCurrentTime;
				const duration = currentSong.formattedDuration;
				const progressBar = createProgressBar(
					queue.currentTime,
					currentSong.duration,
				);

				const nowPlayingMessage =
					`🎵 **Now Playing:**\n${DiscordUtils.formatSongName(currentSong.name || 'Unknown')}\n\n` +
					`⏱️ **Progress:** ${DiscordUtils.formatDuration(progress || '00:00')} / ${DiscordUtils.formatDuration(duration || '00:00')}\n` +
					`${progressBar}\n\n` +
					`🎤 **Requested by:** ${DiscordUtils.formatUser(currentSong.user)}\n` +
					`🔗 **Link:** ${currentSong.url || 'N/A'}`;

				resolve({
					success: true,
					message: nowPlayingMessage,
					data: {
						currentSong,
						queue: queue.songs,
						queueLength: queue.songs.length,
						currentTime: queue.currentTime,
						duration: currentSong.duration,
					},
				});
			} catch (error) {
				this.logger.error('Error in getNowPlaying method', error);
				resolve({
					success: false,
					message: MusicResponse.GENERIC_ERROR,
				});
			}
		});
	}

	/**
	 * Remove a song from the queue by position or name
	 */
	async removeSong(
		interaction: ChatInputCommandInteraction,
		options: { position?: number; songName?: string },
	): Promise<{
		success: boolean;
		message: string;
		data?: {
			songName: string;
			position: number;
			method: 'position' | 'name';
		};
	}> {
		return new Promise((resolve) => {
			try {
				const guildId = interaction.guildId;
				if (!guildId) {
					resolve({
						success: false,
						message: MusicResponse.GENERIC_ERROR,
					});
					return;
				}

				const distube = this.distubeService.getDistube();
				const queue = distube.getQueue(guildId) as ExtendedQueue | null;

				if (!queue?.songs?.length) {
					resolve({
						success: false,
						message: 'No songs in queue.',
					});
					return;
				}

				let songToRemove: ExtendedSong | null = null;
				let removeIndex = -1;
				let method: 'position' | 'name' = 'position'; // Default value

				if (options.position) {
					// Remove by position (1-based)
					removeIndex = options.position - 1;
					if (removeIndex < 0 || removeIndex >= queue.songs.length) {
						resolve({
							success: false,
							message: `Invalid position. Queue has ${queue.songs.length} songs (from 1-${queue.songs.length}).`,
						});
						return;
					}
					songToRemove = queue.songs[removeIndex];
					// method remains 'position' (default value)
				} else if (options.songName) {
					// Remove by name (fuzzy search)
					const searchTerm = options.songName.toLowerCase();
					for (let i = 0; i < queue.songs.length; i++) {
						const song = queue.songs[i];
						if (
							song.name?.toLowerCase().includes(searchTerm) ||
							song.uploader?.name?.toLowerCase().includes(searchTerm)
						) {
							songToRemove = song;
							removeIndex = i;
							method = 'name';
							break;
						}
					}

					if (!songToRemove) {
						resolve({
							success: false,
							message: `No song found with name: "${options.songName}".`,
						});
						return;
					}
				}

				// Cannot remove currently playing song (index 0)
				if (removeIndex === 0) {
					resolve({
						success: false,
						message:
							'Cannot remove currently playing song. Use `/skip` to change song.',
					});
					return;
				}

				// Remove the song
				queue.songs.splice(removeIndex, 1);

				resolve({
					success: true,
					message: 'Song removed from queue.',
					data: {
						songName: (songToRemove?.name as string) || 'Unknown',
						position: removeIndex + 1, // Convert back to 1-based
						method,
					},
				});
			} catch (error) {
				this.logger.error('Error removing song', error);
				resolve({
					success: false,
					message: MusicResponse.GENERIC_ERROR,
				});
			}
		});
	}

	/**
	 * Shuffle the queue
	 */
	async shuffle(
		interaction: ChatInputCommandInteraction,
	): Promise<MusicOperationResult> {
		return new Promise((resolve) => {
			try {
				const validation = MusicValidationUtils.validateGuildAndGetQueue(
					interaction,
					this.distubeService.getDistube(),
				);

				if (!validation.success) {
					resolve({
						success: false,
						message: validation.message,
					});
					return;
				}

				const { queue } = validation as { success: true; queue: ExtendedQueue };

				if (queue.songs.length < 2) {
					resolve({
						success: false,
						message: '⚠️ **Need at least 2 songs to shuffle**',
					});
					return;
				}

				// Shuffle the queue (keep current song at index 0)
				queue.shuffle().catch((shuffleError) => {
					this.logger.error('Error shuffling queue', shuffleError);
				});

				resolve({
					success: true,
					message: `🔀 **Shuffled ${queue.songs.length - 1} songs in queue**`,
				});
			} catch (error) {
				this.logger.error('Error shuffling queue', error);
				resolve({
					success: false,
					message: MusicResponse.GENERIC_ERROR,
				});
			}
		});
	}
}
