import { LoopMode, LoopModeNames } from '../enums/loop.enum';
import { MusicResponse } from '../enums/music.enum';
import { PlaylistDuplicateAction } from '../enums/playlist-duplicate.enum';
import {
	MusicOperationResult,
	PlayResult,
	QueueResult,
	SkipResult,
} from '../interfaces/music.interface';
import { DiscordUtils } from '../utils/discord.utils';
import { DuplicateUtils } from '../utils/duplicate.utils';
import { PlaylistInteractionUtils } from '../utils/playlist-interaction.utils';
import { Injectable, Logger } from '@nestjs/common';
import { ChatInputCommandInteraction, VoiceBasedChannel } from 'discord.js';
import { RepeatMode } from 'distube';

import { DisTubeService } from './distube.service';

@Injectable()
export class MusicService {
	private readonly logger = new Logger(MusicService.name);

	constructor(private readonly distubeService: DisTubeService) {}

	/**
	 * Play a song from URL or search query
	 */
	async play(
		interaction: ChatInputCommandInteraction,
		query: string,
	): Promise<PlayResult> {
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

				const member = interaction.guild?.members.cache.get(
					interaction.user.id,
				);
				const voiceChannel = member?.voice?.channel as VoiceBasedChannel;

				if (!voiceChannel) {
					resolve({
						success: false,
						message: MusicResponse.NOT_IN_VOICE_CHANNEL,
					});
					return;
				}

				const distube = this.distubeService.getDistube();

				// Check if queue exists and has songs before playing
				const existingQueue = distube.getQueue(guildId);
				const wasQueueEmpty =
					!existingQueue || existingQueue.songs.length === 0;

				// Store original queue length before adding new songs
				const originalQueueLength = existingQueue?.songs.length || 0;

				// Play the song
				distube
					.play(voiceChannel, query, {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
						member: interaction.member as any,
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
						textChannel: interaction.channel as any,
					})
					.then(async () => {
						// After playing, check the final queue state
						const finalQueue = distube.getQueue(guildId);
						const currentSong = finalQueue?.songs[0];
						const totalSongs = finalQueue?.songs.length || 0;
						const songsAdded =
							totalSongs - (wasQueueEmpty ? 0 : originalQueueLength);

						// Detect if this was a playlist by checking if multiple songs were added
						const isPlaylist = songsAdded > 1;

						// Handle playlist duplicates
						if (isPlaylist && !wasQueueEmpty && existingQueue?.songs) {
							const addedSongs = finalQueue?.songs.slice(-songsAdded) || [];
							// Use original queue songs (before new additions)
							const originalQueueSongs =
								finalQueue?.songs.slice(0, originalQueueLength) || [];

							const duplicateAnalysis = DuplicateUtils.checkPlaylistDuplicates(
								addedSongs,
								originalQueueSongs,
							);

							// If duplicates found and significant (>10%), offer user choice
							if (
								duplicateAnalysis.duplicateCount > 0 &&
								duplicateAnalysis.duplicateCount /
									duplicateAnalysis.totalSongs >
									0.1
							) {
								// Show duplicate summary and wait for user choice
								const duplicateMessage =
									DuplicateUtils.generatePlaylistDuplicateMessage(
										duplicateAnalysis.totalSongs,
										duplicateAnalysis.duplicateCount,
										duplicateAnalysis.duplicates,
									);

								// Edit original response with duplicate info
								await interaction.editReply({
									content: duplicateMessage,
								});

								// Wait for user choice
								const userChoice =
									await PlaylistInteractionUtils.waitForUserChoice(
										interaction,
										30000,
									);

								if (userChoice) {
									const result = await this.handlePlaylistDuplicateChoice(
										interaction,
										userChoice,
										duplicateAnalysis,
									);

									resolve(result);
									return;
								} else {
									// Timeout - default to ADD_ALL
									const finalMessage =
										PlaylistInteractionUtils.generateResultMessage(
											PlaylistDuplicateAction.ADD_ALL,
											duplicateAnalysis.totalSongs,
											duplicateAnalysis.duplicateCount,
											duplicateAnalysis.newSongs.length,
										);

									resolve({
										success: true,
										message: finalMessage,
										data: {
											songName: currentSong?.name,
											duration: currentSong?.formattedDuration,
											isNowPlaying: wasQueueEmpty,
											wasQueueEmpty,
											isPlaylist,
											songsAdded,
											queuePosition: wasQueueEmpty
												? 0
												: (existingQueue?.songs.length || 0) - 1,
										},
									});
									return;
								}
							}
						}

						// Check for duplicates (only for single songs, not playlists)
						let duplicateWarning = '';

						if (!isPlaylist) {
							// For single songs, check duplicates against original queue only
							const songsToCheck = wasQueueEmpty
								? []
								: finalQueue?.songs.slice(0, originalQueueLength) || [];

							if (songsToCheck.length > 0 && currentSong) {
								const duplicateCheck = DuplicateUtils.checkDuplicate(
									currentSong,
									songsToCheck,
								);
								if (
									duplicateCheck.isDuplicate &&
									currentSong.name &&
									duplicateCheck.position &&
									duplicateCheck.matchType
								) {
									duplicateWarning = `\n\n${DuplicateUtils.generateDuplicateWarning(
										currentSong.name,
										duplicateCheck.position,
										duplicateCheck.matchType,
									)}`;
								}
							}
						}

						resolve({
							success: true,
							message: MusicResponse.SONG_ADDED,
							data: {
								songName: currentSong?.name,
								duration: currentSong?.formattedDuration,
								isNowPlaying: wasQueueEmpty, // If queue was empty, song is now playing
								wasQueueEmpty,
								isPlaylist,
								songsAdded,
								queuePosition: wasQueueEmpty ? 0 : originalQueueLength - 1, // Subtract 1 because DisTube counts currently playing song
								duplicateWarning, // Add duplicate warning to response
							},
						});
					})
					.catch((error) => {
						this.logger.error('Error playing song', error);
						resolve({
							success: false,
							message: MusicResponse.PLAY_ERROR,
						});
					});
			} catch (error) {
				this.logger.error('Error in play method', error);
				resolve({
					success: false,
					message: MusicResponse.GENERIC_ERROR,
				});
			}
		});
	}

	/**
	 * Handle user choice for playlist duplicates
	 */
	private async handlePlaylistDuplicateChoice(
		interaction: ChatInputCommandInteraction,
		choice: PlaylistDuplicateAction,
		duplicateAnalysis: {
			totalSongs: number;
			duplicates: Array<{
				song: any;
				existingPosition: number;
				matchType: 'url' | 'name' | 'both';
			}>;
			newSongs: any[];
			duplicateCount: number;
		},
	): Promise<PlayResult> {
		return new Promise((resolve) => {
			const guildId = interaction.guildId;
			if (!guildId) {
				resolve({
					success: false,
					message: MusicResponse.GENERIC_ERROR,
				});
				return;
			}

			const distube = this.distubeService.getDistube();
			const queue = distube.getQueue(guildId);

			if (!queue) {
				resolve({
					success: false,
					message: MusicResponse.NO_QUEUE,
				});
				return;
			}

			const currentSong = queue.songs[0];

			switch (choice) {
				case PlaylistDuplicateAction.ADD_ALL:
					// Already added, just return success message
					break;

				case PlaylistDuplicateAction.NEW_ONLY:
					// Remove duplicate songs from queue
					for (const duplicate of duplicateAnalysis.duplicates.reverse()) {
						// Find the newly added duplicate in queue and remove it
						const songIndex = queue.songs.findIndex(
							// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
							(s: any) => s.url === duplicate.song.url,
						);
						if (songIndex > 0) {
							// Don't remove currently playing song
							queue.songs.splice(songIndex, 1);
						}
					}
					break;

				case PlaylistDuplicateAction.CANCEL: {
					// Remove all newly added songs from playlist
					const songsToRemove = duplicateAnalysis.totalSongs;
					// Remove from the end (newly added songs)
					for (let i = 0; i < songsToRemove; i++) {
						if (queue.songs.length > 1) {
							// Don't remove currently playing song
							queue.songs.pop();
						}
					}
					break;
				}
			}

			const finalMessage = PlaylistInteractionUtils.generateResultMessage(
				choice,
				duplicateAnalysis.totalSongs,
				duplicateAnalysis.duplicateCount,
				duplicateAnalysis.newSongs.length,
			);

			resolve({
				success: true,
				message: finalMessage,
				data: {
					songName: currentSong?.name,
					duration: currentSong?.formattedDuration,
					isNowPlaying: false, // Already playing when we got here
					wasQueueEmpty: false,
					isPlaylist: true,
					songsAdded:
						choice === PlaylistDuplicateAction.NEW_ONLY
							? duplicateAnalysis.newSongs.length
							: duplicateAnalysis.totalSongs,
					queuePosition: 0,
				},
			});
		});
	}

	/**
	 * Skip current song
	 */
	async skip(interaction: ChatInputCommandInteraction): Promise<SkipResult> {
		try {
			const guildId = interaction.guildId;
			if (!guildId) {
				return {
					success: false,
					message: MusicResponse.GENERIC_ERROR,
				};
			}

			const member = interaction.guild?.members.cache.get(interaction.user.id);
			const voiceChannel = member?.voice?.channel as VoiceBasedChannel;

			if (!voiceChannel) {
				return {
					success: false,
					message: MusicResponse.NOT_IN_VOICE_CHANNEL,
				};
			}

			const distube = this.distubeService.getDistube();
			const queue = distube.getQueue(guildId);

			if (!queue) {
				return {
					success: false,
					message: MusicResponse.NO_QUEUE,
				};
			}

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
			const guildId = interaction.guildId;
			if (!guildId) {
				return {
					success: false,
					message: MusicResponse.GENERIC_ERROR,
				};
			}

			const member = interaction.guild?.members.cache.get(interaction.user.id);
			const voiceChannel = member?.voice?.channel as VoiceBasedChannel;

			if (!voiceChannel) {
				return {
					success: false,
					message: MusicResponse.NOT_IN_VOICE_CHANNEL,
				};
			}

			const distube = this.distubeService.getDistube();
			const queue = distube.getQueue(guildId);

			if (!queue) {
				return {
					success: false,
					message: MusicResponse.NO_QUEUE,
				};
			}

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
				const queue = distube.getQueue(guildId);

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
				const queue = distube.getQueue(guildId);

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
				const progressBar = this.createProgressBar(
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
	 * Set volume
	 */
	async setVolume(
		interaction: ChatInputCommandInteraction,
		volume: number,
	): Promise<MusicOperationResult> {
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

				const member = interaction.guild?.members.cache.get(
					interaction.user.id,
				);
				const voiceChannel = member?.voice?.channel as VoiceBasedChannel;

				if (!voiceChannel) {
					resolve({
						success: false,
						message: MusicResponse.NOT_IN_VOICE_CHANNEL,
					});
					return;
				}

				const distube = this.distubeService.getDistube();
				const queue = distube.getQueue(guildId);

				if (!queue) {
					resolve({
						success: false,
						message: MusicResponse.NO_QUEUE,
					});
					return;
				}

				if (volume < 0 || volume > 100) {
					resolve({
						success: false,
						message: MusicResponse.INVALID_VOLUME,
					});
					return;
				}

				try {
					distube.setVolume(guildId, volume);
					resolve({
						success: true,
						message: `🔊 Volume set to ${volume}%`,
					});
				} catch (volumeError) {
					this.logger.error('Error setting volume', volumeError);
					resolve({
						success: false,
						message: MusicResponse.GENERIC_ERROR,
					});
				}
			} catch (error) {
				this.logger.error('Error in setVolume method', error);
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
				const queue = distube.getQueue(guildId);

				if (!queue || !queue.songs.length) {
					resolve({
						success: false,
						message: 'No songs in queue.',
					});
					return;
				}

				let songToRemove: any = null;
				let removeIndex = -1;
				let method: 'position' | 'name' = 'position';

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
					method = 'position';
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
						// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
	 * Create a progress bar for now playing
	 */
	private createProgressBar(currentTime: number, totalTime: number): string {
		const progress = Math.round((currentTime / totalTime) * 10);
		const emptyProgress = 10 - progress;

		const progressChars = '▓'.repeat(progress);
		const emptyProgressChars = '░'.repeat(emptyProgress);

		return `${progressChars}${emptyProgressChars}`;
	}

	/**
	 * Set loop mode for the queue
	 */
	setLoop(
		interaction: ChatInputCommandInteraction,
		mode: LoopMode,
	): Promise<MusicOperationResult> {
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
				const queue = distube.getQueue(guildId);

				if (!queue) {
					resolve({
						success: false,
						message: MusicResponse.NO_QUEUE,
					});
					return;
				}

				// Set the loop mode (DisTube RepeatMode: 0=OFF, 1=SONG, 2=QUEUE)
				queue.setRepeatMode(mode as unknown as RepeatMode);

				const modeText = LoopModeNames[mode];
				const emoji =
					mode === LoopMode.OFF ? '⏹️' : mode === LoopMode.SONG ? '🔂' : '🔁';

				resolve({
					success: true,
					message: `${emoji} **Loop mode:** ${modeText}`,
				});
			} catch (error) {
				this.logger.error('Error setting loop mode', error);
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
				const guildId = interaction.guildId;
				if (!guildId) {
					resolve({
						success: false,
						message: MusicResponse.GENERIC_ERROR,
					});
					return;
				}

				const distube = this.distubeService.getDistube();
				const queue = distube.getQueue(guildId);

				if (!queue) {
					resolve({
						success: false,
						message: MusicResponse.NO_QUEUE,
					});
					return;
				}

				if (queue.songs.length < 2) {
					resolve({
						success: false,
						message: '⚠️ **Need at least 2 songs to shuffle**',
					});
					return;
				}

				// Shuffle the queue (keep current song at index 0)
				void queue.shuffle();

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
