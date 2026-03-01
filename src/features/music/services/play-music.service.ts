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
import { Song } from 'distube';

import { DisTubeService } from './distube.service';
import { PlaylistDuplicateService } from './playlist-duplicate.service';
import { YoutubeApiService } from './youtube-api.service';

interface PlayExecutionContext {
	interaction: ChatInputCommandInteraction;
	guildId: string;
	voiceChannel: VoiceBasedChannel;
	query: string;
	wasQueueEmpty: boolean;
	originalQueueLength: number;
	existingQueue: ExtendedQueue | null;
	resolve: (result: PlayResult) => void;
}

@Injectable()
export class PlayMusicService {
	private readonly logger = new Logger(PlayMusicService.name);

	constructor(
		private readonly distubeService: DisTubeService,
		private readonly playlistDuplicateService: PlaylistDuplicateService,
		private readonly youtubeApiService: YoutubeApiService,
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
				void this.executePlay(
					interaction,
					guildId,
					voiceChannel,
					query,
					resolve,
				);
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
	private async executePlay(
		interaction: ChatInputCommandInteraction,
		guildId: string,
		voiceChannel: VoiceBasedChannel,
		query: string,
		resolve: (result: PlayResult) => void,
	): Promise<void> {
		const distube = this.distubeService.getDistube();
		const existingQueue = distube.getQueue(guildId) as ExtendedQueue | null;
		const wasQueueEmpty = !existingQueue || existingQueue.songs.length === 0;
		const originalQueueLength = existingQueue?.songs.length || 0;

		// Build context object
		const context: PlayExecutionContext = {
			interaction,
			guildId,
			voiceChannel,
			query,
			wasQueueEmpty,
			originalQueueLength,
			existingQueue,
			resolve,
		};

		// YouTube API playlist optimization
		// Only use API for standard playlists (PL*, UU*, FL*, etc.)
		// Exclude YouTube Mixes (RD*) as they're not supported by the API
		const isYouTubePlaylist = this.isYouTubeStandardPlaylist(query);

		if (isYouTubePlaylist) {
			const handled = await this.handleYouTubePlaylist(context);
			if (handled) {
				return;
			}
		}

		// Strip Mix parameters before fallback to prevent DisTube from hanging
		// YouTube Mixes (RD*) should play as single songs for instant playback
		let cleanedQuery = query;
		if (query.includes('youtube.com') && query.includes('list=')) {
			cleanedQuery = this.stripMixParameters(query);
			this.logger.log(
				'Stripped Mix/playlist parameters from URL for instant playback',
			);
		}

		// Update context with cleaned query
		const fallbackContext: PlayExecutionContext = {
			...context,
			query: cleanedQuery,
		};

		// Fallback to original behavior (yt-dlp)
		this.handleSingleSongOrFallback(fallbackContext);
	}

	/**
	 * Check if query is a YouTube standard playlist (not a Mix)
	 * Standard playlists: PL*, UU*, FL*, LL*, etc.
	 * Mixes (not supported): RD*, RDMM*, RDAO*, RDCLAK*, etc.
	 */
	private isYouTubeStandardPlaylist(query: string): boolean {
		if (!query.includes('youtube.com') || !query.includes('list=')) {
			return false;
		}

		try {
			const urlParams = new URLSearchParams(query.split('?')[1]);
			const playlistId = urlParams.get('list');

			if (!playlistId) {
				return false;
			}

			// Exclude YouTube Mixes (they start with 'RD')
			// This prevents hanging on API calls that don't support Mixes
			if (playlistId.startsWith('RD')) {
				this.logger.log(
					`Detected YouTube Mix (${playlistId}), skipping API optimization`,
				);
				return false;
			}

			// Accept all other playlist types
			return true;
		} catch {
			this.logger.warn(`Failed to parse playlist URL: ${query}`);
			return false;
		}
	}

	/**
	 * Strip Mix and playlist parameters from YouTube URL
	 * Converts: https://www.youtube.com/watch?v=VIDEO_ID&list=RDXXX&start_radio=1
	 * To:       https://www.youtube.com/watch?v=VIDEO_ID
	 * This forces DisTube to treat it as a single song for instant playback
	 */
	private stripMixParameters(url: string): string {
		try {
			const urlObj = new URL(url);

			// Keep only the video ID parameter
			const videoId = urlObj.searchParams.get('v');

			if (!videoId) {
				this.logger.warn('No video ID found in URL, returning original');
				return url;
			}

			// Reconstruct URL with only video ID
			return `https://www.youtube.com/watch?v=${videoId}`;
		} catch (error) {
			this.logger.error(`Failed to parse URL: ${url}`, error);
			return url; // Return original on error
		}
	}

	/**
	 * Handle YouTube playlist using YouTube API
	 * Returns true if handled successfully, false to trigger fallback
	 */
	private async handleYouTubePlaylist(
		context: PlayExecutionContext,
	): Promise<boolean> {
		const {
			interaction,
			guildId,
			voiceChannel,
			query,
			wasQueueEmpty,
			originalQueueLength,
			existingQueue,
			resolve,
		} = context;

		// Show playlist loading message (only for valid playlists)
		await interaction.editReply(
			'⏳ Fetching playlist via YouTube API. Please wait a moment...',
		);

		const distube = this.distubeService.getDistube();

		try {
			const apiItems = await this.youtubeApiService.getPlaylistItems(query);

			if (!apiItems || apiItems.length === 0) {
				this.logger.warn('YouTube API failed, falling back to yt-dlp');
				return false;
			}

			// Extract playlist ID for logging
			const urlParams = new URLSearchParams(query.split('?')[1]);
			const playlistId = urlParams.get('list');
			this.logger.log(`Using YouTube API for playlist: ${playlistId}`);

			// Create Song objects with metadata from YouTube API
			// This bypasses DisTube's yt-dlp resolution and prevents freezing
			const songs: Song[] = [];
			for (const item of apiItems) {
				try {
					// Create Song with required DisTube v5 fields
					const song = new Song({
						plugin: null,
						source: 'youtube',
						playFromSource: true,
						id: item.id,
						name: item.name,
						url: item.url,
						thumbnail: item.thumbnail,
						uploader: item.uploader
							? { name: item.uploader, url: undefined }
							: undefined,
						duration: item.duration || 0, // Use real duration from YouTube API
					});
					songs.push(song);
				} catch (error) {
					// Skip invalid videos (deleted, private, etc.) and continue
					this.logger.warn(
						`Skipping invalid video ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
					);
				}
			}

			if (songs.length === 0) {
				this.logger.warn('No valid songs in playlist, falling back to yt-dlp');
				return false;
			}

			this.logger.log(
				`Created ${songs.length} Song objects from ${apiItems.length} API items`,
			);

			// Create custom playlist with pre-constructed Song objects
			const customPlaylist = await distube.createCustomPlaylist(songs, {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				member: interaction.member as any,
				name: 'YouTube Playlist',
				source: 'youtube',
			});

			// Play the custom playlist
			await distube
				.play(voiceChannel, customPlaylist, {
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
					this.logger.error('Error playing custom playlist', error);
					resolve({
						success: false,
						message: MusicResponse.PLAY_ERROR,
					});
				});

			return true;
		} catch {
			this.logger.warn('YouTube API failed, falling back to yt-dlp');
			return false;
		}
	}

	/**
	 * Handle single song or fallback to yt-dlp
	 */
	private handleSingleSongOrFallback(context: PlayExecutionContext): void {
		const {
			interaction,
			guildId,
			voiceChannel,
			query,
			wasQueueEmpty,
			originalQueueLength,
			existingQueue,
			resolve,
		} = context;

		const distube = this.distubeService.getDistube();

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
