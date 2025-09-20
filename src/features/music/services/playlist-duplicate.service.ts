import { MusicResponse } from '../enums/music.enum';
import { PlaylistDuplicateAction } from '../enums/playlist-duplicate.enum';
import {
	DuplicateAnalysisResult,
	ExtendedQueue,
	ExtendedSong,
	HandleSignificantPlaylistDuplicatesParams,
	ProcessPlaylistDuplicatesParams,
	toSongArray,
} from '../interfaces/distube-types.interface';
import { PlayResult } from '../interfaces/music.interface';
import { DuplicateUtils } from '../utils/duplicate.utils';
import { PlaylistInteractionUtils } from '../utils/playlist-interaction.utils';
import { Injectable, Logger } from '@nestjs/common';
import { ChatInputCommandInteraction } from 'discord.js';

import { DisTubeService } from './distube.service';

@Injectable()
export class PlaylistDuplicateService {
	private readonly logger = new Logger(PlaylistDuplicateService.name);

	constructor(private readonly distubeService: DisTubeService) {}

	/**
	 * Process playlist duplicates
	 */
	async processPlaylistDuplicates(
		params: ProcessPlaylistDuplicatesParams,
		createSuccessResult: (
			currentSong: ExtendedSong | undefined,
			wasQueueEmpty: boolean,
			isPlaylist: boolean,
			songsAdded: number,
			originalQueueLength: number,
			duplicateWarning: string,
		) => PlayResult,
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
				createSuccessResult(
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
	async handleSignificantPlaylistDuplicates(
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
	 * Handle user choice for playlist duplicates
	 */
	async handlePlaylistDuplicateChoice(
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
}
