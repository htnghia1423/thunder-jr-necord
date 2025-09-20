import { MusicResponse } from '../enums/music.enum';
import {
	DuplicateCheckResult,
	ExtendedQueue,
	ExtendedSong,
	toSong,
	toSongArray,
} from '../interfaces/distube-types.interface';
import { PlayResult } from '../interfaces/music.interface';
import { DuplicateUtils } from '../utils/duplicate.utils';
import { MusicValidationUtils } from '../utils/music-validation.utils';
import { Injectable, Logger } from '@nestjs/common';
import { ChatInputCommandInteraction, VoiceBasedChannel } from 'discord.js';

import { DisTubeService } from './distube.service';
import { PlaylistDuplicateService } from './playlist-duplicate.service';

@Injectable()
export class PlayMusicService {
	private readonly logger = new Logger(PlayMusicService.name);

	constructor(
		private readonly distubeService: DisTubeService,
		private readonly playlistDuplicateService: PlaylistDuplicateService,
	) {}

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
			const createSuccessResultFn = (
				currentSong: ExtendedSong | undefined,
				wasQueueEmpty: boolean,
				isPlaylist: boolean,
				songsAdded: number,
				originalQueueLength: number,
				duplicateWarning: string,
			): PlayResult =>
				this.createSuccessResult(
					currentSong,
					wasQueueEmpty,
					isPlaylist,
					songsAdded,
					originalQueueLength,
					duplicateWarning,
				);

			await this.playlistDuplicateService.processPlaylistDuplicates(
				{
					interaction,
					finalQueue,
					songsAdded,
					originalQueueLength,
					currentSong,
					wasQueueEmpty,
					isPlaylist,
					existingQueue,
					resolve,
				},
				createSuccessResultFn,
			);
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
	createSuccessResult(
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
}
