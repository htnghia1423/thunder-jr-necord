import { LoopMode, LoopModeNames } from '../enums/loop.enum';
import { MusicResponse } from '../enums/music.enum';
import { PlaylistDuplicateAction } from '../enums/playlist-duplicate.enum';
import {
	DuplicateAnalysisResult,
	DuplicateCheckResult,
	ExtendedQueue,
	ExtendedSong,
	HandleSignificantPlaylistDuplicatesParams,
	ProcessPlaylistDuplicatesParams,
	toSong,
	toSongArray,
} from '../interfaces/distube-types.interface';
import {
	MusicOperationResult,
	PlayResult,
	QueueResult,
	SkipResult,
} from '../interfaces/music.interface';
import { DiscordUtils } from '../utils/discord.utils';
import { DuplicateUtils } from '../utils/duplicate.utils';
import { MusicValidationUtils } from '../utils/music-validation.utils';
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
				const validation =
					MusicValidationUtils.validateBasicRequirements(interaction);

				if (!validation.success) {
					resolve({
						success: false,
						message: validation.message!,
					});
					return;
				}

				const { guildId, voiceChannel } = validation.data!;
				this.executePlay(interaction, guildId, voiceChannel, query, resolve);
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
	 * Execute the actual play operation
	 */
	private executePlay(
		interaction: ChatInputCommandInteraction,
		guildId: string,
		voiceChannel: VoiceBasedChannel,
		query: string,
		resolve: (result: PlayResult) => void,
	): void {
		const distube = this.distubeService.getDistube();
		const existingQueue = distube.getQueue(guildId) as ExtendedQueue | null;
		const wasQueueEmpty = !existingQueue || existingQueue.songs.length === 0;
		const originalQueueLength = existingQueue?.songs.length || 0;

		distube
			.play(voiceChannel, query, {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				member: interaction.member as any,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				textChannel: interaction.channel as any,
			})
			.then(async () => {
				await this.handlePlaySuccess(
					interaction,
					guildId,
					wasQueueEmpty,
					originalQueueLength,
					existingQueue,
					resolve,
				);
			})
			.catch((error) => {
				this.logger.error('Error playing song', error);
				resolve({
					success: false,
					message: MusicResponse.PLAY_ERROR,
				});
			});
	}

	/**
	 * Handle successful play operation
	 */
	private async handlePlaySuccess(
		interaction: ChatInputCommandInteraction,
		guildId: string,
		wasQueueEmpty: boolean,
		originalQueueLength: number,
		existingQueue: ExtendedQueue | null,
		resolve: (result: PlayResult) => void,
	): Promise<void> {
		const distube = this.distubeService.getDistube();
		const finalQueue = distube.getQueue(guildId) as ExtendedQueue | null;
		const currentSong = finalQueue?.songs[0];
		const totalSongs = finalQueue?.songs.length || 0;
		const songsAdded = totalSongs - (wasQueueEmpty ? 0 : originalQueueLength);
		const isPlaylist = songsAdded > 1;

		// Handle playlist duplicates if applicable
		const shouldHandlePlaylistDuplicates =
			isPlaylist && !wasQueueEmpty && existingQueue?.songs;

		if (shouldHandlePlaylistDuplicates) {
			await this.processPlaylistDuplicates({
				interaction,
				finalQueue,
				songsAdded,
				originalQueueLength,
				currentSong,
				wasQueueEmpty,
				isPlaylist,
				existingQueue,
				resolve,
			});
			return;
		}

		// Handle single song duplicates
		const duplicateWarning = this.getSingleSongDuplicateWarning(
			isPlaylist,
			wasQueueEmpty,
			finalQueue,
			originalQueueLength,
			currentSong,
		);

		// Return successful result
		resolve(
			this.createSuccessResult(
				currentSong,
				wasQueueEmpty,
				isPlaylist,
				songsAdded,
				originalQueueLength,
				duplicateWarning,
			),
		);
	}

	/**
	 * Process playlist duplicates
	 */
	private async processPlaylistDuplicates(
		params: ProcessPlaylistDuplicatesParams,
	): Promise<void> {
		const {
			interaction,
			finalQueue,
			songsAdded,
			originalQueueLength,
			currentSong,
			wasQueueEmpty,
			isPlaylist,
			existingQueue,
			resolve,
		} = params;

		const addedSongs = finalQueue?.songs.slice(-songsAdded) || [];
		const originalQueueSongs =
			finalQueue?.songs.slice(0, originalQueueLength) || [];

		const duplicateAnalysis = DuplicateUtils.checkPlaylistDuplicates(
			toSongArray(addedSongs),
			toSongArray(originalQueueSongs),
		) as DuplicateAnalysisResult;

		const duplicateThreshold = 0.1;
		const hasSignificantDuplicates =
			duplicateAnalysis.duplicateCount > 0 &&
			duplicateAnalysis.duplicateCount / duplicateAnalysis.totalSongs >
				duplicateThreshold;

		if (hasSignificantDuplicates) {
			await this.handleSignificantPlaylistDuplicates({
				interaction,
				duplicateAnalysis,
				currentSong,
				wasQueueEmpty,
				isPlaylist,
				songsAdded,
				existingQueue,
				resolve,
			});
		} else {
			resolve(
				this.createSuccessResult(
					currentSong,
					wasQueueEmpty,
					isPlaylist,
					songsAdded,
					originalQueueLength,
					'',
				),
			);
		}
	}

	/**
	 * Handle significant playlist duplicates
	 */
	private async handleSignificantPlaylistDuplicates(
		params: HandleSignificantPlaylistDuplicatesParams,
	): Promise<void> {
		const {
			interaction,
			duplicateAnalysis,
			currentSong,
			wasQueueEmpty,
			isPlaylist,
			songsAdded,
			existingQueue,
			resolve,
		} = params;

		const duplicateMessage = DuplicateUtils.generatePlaylistDuplicateMessage(
			duplicateAnalysis.totalSongs,
			duplicateAnalysis.duplicateCount,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			duplicateAnalysis.duplicates as any,
		);

		await interaction.editReply({ content: duplicateMessage });

		const userChoice = await PlaylistInteractionUtils.waitForUserChoice(
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
		} else {
			// Timeout - default to ADD_ALL
			const finalMessage = PlaylistInteractionUtils.generateResultMessage(
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
		}
	}

	/**
	 * Get duplicate warning for single songs
	 */
	private getSingleSongDuplicateWarning(
		isPlaylist: boolean,
		wasQueueEmpty: boolean,
		finalQueue: ExtendedQueue | null,
		originalQueueLength: number,
		currentSong: ExtendedSong | undefined,
	): string {
		if (isPlaylist) {
			return '';
		}

		const songsToCheck = wasQueueEmpty
			? []
			: finalQueue?.songs.slice(0, originalQueueLength) || [];

		if (songsToCheck.length === 0 || !currentSong) {
			return '';
		}

		const duplicateCheck = DuplicateUtils.checkDuplicate(
			toSong(currentSong),
			toSongArray(songsToCheck),
		) as DuplicateCheckResult;

		if (this.isDuplicateCheckValid(duplicateCheck, currentSong)) {
			return `\n\n${DuplicateUtils.generateDuplicateWarning(
				currentSong.name,
				duplicateCheck.position!,
				duplicateCheck.matchType!,
			)}`;
		}

		return '';
	}

	/**
	 * Check if duplicate check result is valid
	 */
	private isDuplicateCheckValid(
		duplicateCheck: DuplicateCheckResult,
		currentSong: ExtendedSong | undefined,
	): boolean {
		return Boolean(
			duplicateCheck.isDuplicate &&
				currentSong?.name &&
				duplicateCheck.position &&
				duplicateCheck.matchType,
		);
	}

	/**
	 * Create success result object
	 */
	private createSuccessResult(
		currentSong: ExtendedSong | undefined,
		wasQueueEmpty: boolean,
		isPlaylist: boolean,
		songsAdded: number,
		originalQueueLength: number,
		duplicateWarning: string,
	): PlayResult {
		return {
			success: true,
			message: MusicResponse.SONG_ADDED,
			data: {
				songName: currentSong?.name,
				duration: currentSong?.formattedDuration,
				isNowPlaying: wasQueueEmpty,
				wasQueueEmpty,
				isPlaylist,
				songsAdded,
				queuePosition: wasQueueEmpty ? 0 : originalQueueLength - 1,
				duplicateWarning,
			},
		};
	}

	/**
	 * Handle user choice for playlist duplicates
	 */
	private async handlePlaylistDuplicateChoice(
		interaction: ChatInputCommandInteraction,
		choice: PlaylistDuplicateAction,
		duplicateAnalysis: DuplicateAnalysisResult,
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
			const queue = distube.getQueue(guildId) as ExtendedQueue | null;

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

				case PlaylistDuplicateAction.NEW_ONLY: {
					// Remove duplicate songs from queue
					const reversedDuplicates = [
						...duplicateAnalysis.duplicates,
					].reverse();
					for (const duplicate of reversedDuplicates) {
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
				}

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
				const queue = distube.getQueue(guildId) as ExtendedQueue | null;

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
				const queue = distube.getQueue(guildId) as ExtendedQueue | null;

				if (!queue || !queue.songs.length) {
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
				const queue = distube.getQueue(guildId) as ExtendedQueue | null;

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
				let emoji: string;
				if (mode === LoopMode.OFF) {
					emoji = '⏹️';
				} else if (mode === LoopMode.SONG) {
					emoji = '🔂';
				} else {
					emoji = '🔁';
				}

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
				const queue = distube.getQueue(guildId) as ExtendedQueue | null;

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
