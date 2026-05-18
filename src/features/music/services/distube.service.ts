import { PaginationControlsComponent } from '../components/pagination-controls.component';
import { PlaybackControlsComponent } from '../components/playback-controls.component';
import { MusicResponse } from '../enums/music.enum';
import { MusicConstants } from '../music.constants';
import { EmbedBuilderUtils, QueueLike } from '../utils/embed-builder.utils';
import { SoundCloudPlugin } from '@distube/soundcloud';
import { SpotifyPlugin } from '@distube/spotify';
import { YtDlpPlugin } from '@distube/yt-dlp';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import {
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
} from '@nestjs/common';
import {
	ButtonInteraction,
	Client,
	ComponentType,
	GuildMember,
	Message,
	MessageFlags,
} from 'discord.js';
import { DisTube, Events, Playlist, Queue, Song } from 'distube';

import { LyricsService } from './lyrics.service';
import { MusicStatsService } from './music-stats.service';

/**
 * DisTubeService manages the DisTube instance and handles infrastructure concerns
 * Separated from business logic for better maintainability
 */
@Injectable()
export class DisTubeService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(DisTubeService.name);
	private distube!: DisTube;

	constructor(
		private readonly client: Client,
		private readonly musicStatsService: MusicStatsService,
		private readonly lyricsService: LyricsService,
	) {}

	onModuleInit() {
		this.initializeDistube();
		this.setupEventHandlers();
	}

	onModuleDestroy() {
		this.logger.log('Starting DisTube cleanup...');

		try {
			// Stop all active queues
			this.distube.voices.collection.forEach((queue) => {
				try {
					queue.stop();
					this.logger.log(`Stopped queue for guild ${queue.id}`);
				} catch (error) {
					this.logger.error(
						`Failed to stop queue for guild ${queue.id}`,
						error,
					);
				}
			});

			// Leave all voice channels
			this.distube.voices.collection.forEach((voice) => {
				try {
					this.distube.voices.leave(voice.id);
					this.logger.log(`Left voice channel in guild ${voice.id}`);
				} catch (error) {
					this.logger.error(
						`Failed to leave voice channel in guild ${voice.id}`,
						error,
					);
				}
			});

			// Remove all event listeners to prevent memory leaks
			this.distube.removeAllListeners();
			this.logger.log('Removed all DisTube event listeners');

			this.logger.log('DisTube cleanup completed successfully');
		} catch (error) {
			this.logger.error('Error during DisTube cleanup', error);
		}
	}

	/**
	 * Attach button collector to a Now Playing message
	 */
	public attachPlaybackControls(message: Message<boolean>, queue: Queue): void {
		const collector = message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: MusicConstants.BUTTON_COLLECTOR_TIMEOUT, // 5 minutes
		});

		collector.on('collect', (interaction: ButtonInteraction) => {
			void this.handlePlaybackButtonInteraction(interaction, queue);
		});

		collector.on('end', () => {
			void this.disableButtonsOnCollectorEnd(message);
		});
	}

	/**
	 * Disable all buttons when the collector ends
	 */
	private async disableButtonsOnCollectorEnd(
		message: Message<boolean>,
	): Promise<void> {
		try {
			// Disable all buttons when collector expires using PlaybackControlsComponent
			const disabledButtons = PlaybackControlsComponent.createRows({
				disabled: true,
			});

			await message.edit({ components: disabledButtons }).catch(() => {
				// Message might have been deleted
			});
		} catch (error) {
			this.logger.error('Failed to disable buttons on collector end', error);
		}
	}

	/**
	 * Get the DisTube instance for other services to use
	 */
	getDistube(): DisTube {
		return this.distube;
	}

	private initializeDistube(): void {
		try {
			this.distube = new DisTube(this.client, {
				ffmpeg: {
					path: ffmpegPath.path,
				},
				plugins: [
					new SpotifyPlugin(),
					new SoundCloudPlugin(),
					new YtDlpPlugin({ update: true }), // MUST be last in array
				],
			});

			this.logger.log('DisTube initialized successfully with yt-dlp plugin');
		} catch (error) {
			this.logger.error('Failed to initialize DisTube', error);
			throw error;
		}
	}

	private setupEventHandlers(): void {
		// Set default volume to 100 when a new queue is created
		// DisTube defaults to 50, so we override it here
		this.distube.on(Events.INIT_QUEUE, (queue: Queue) => {
			queue.setVolume(100);
			this.logger.log(
				`New queue initialized in guild ${queue.id}, set volume to 100%`,
			);
		});

		// When a song starts playing - log and record stats
		this.distube.on(Events.PLAY_SONG, (queue: Queue, song: Song) => {
			this.logger.log(`Now playing: ${song.name} in guild ${queue.id}`);

			// Record play statistics (fire and forget)
			// Use user who requested the song, fallback to first member if not available
			const userId = song.user?.id || song.member?.id;
			if (userId && queue.id) {
				void this.musicStatsService
					.recordPlay(queue.id, userId, song)
					.catch((error) => {
						this.logger.error('Failed to record play statistics:', error);
					});
			}
		});

		// When a song is added to queue - just log, don't send message
		this.distube.on(Events.ADD_SONG, (queue: Queue, song: Song) => {
			this.logger.log(`Added to queue: ${song.name} in guild ${queue.id}`);
		});

		// When a playlist is added to queue - just log, don't send message
		this.distube.on(Events.ADD_LIST, (queue: Queue, playlist: Playlist) => {
			this.logger.log(
				`Added playlist to queue: ${playlist.name} (${playlist.songs?.length} songs) in guild ${queue.id}`,
			);
		});

		// When queue ends
		this.distube.on(Events.FINISH, (queue: Queue) => {
			this.logger.log(`Queue finished in guild ${queue.id}`);
			const channel = queue.textChannel;
			if (channel) {
				channel.send('🔚 **Queue has ended!**').catch((error: Error) => {
					this.logger.error('Failed to send finish message', error);
				});
			}
		});

		// Handle errors - DisTube v5 signature: (error, queue, song)
		// We only use error and queue parameters
		this.distube.on(Events.ERROR, (error: Error, queue: Queue) => {
			this.logger.error('DisTube error:', error);
			// Safely extract textChannel from queue object
			const textChannel = queue?.textChannel;
			if (textChannel) {
				textChannel
					.send(`❌ **Error:** ${error.message}`)
					.catch((sendError: Error) => {
						this.logger.error('Failed to send error message', sendError);
					});
			}
		});

		// Handle disconnect event - when bot is disconnected from voice channel
		this.distube.on(Events.DISCONNECT, async (queue: Queue) => {
			this.logger.log(
				`Bot disconnected from voice channel in guild ${queue.id}`,
			);
			try {
				await queue.stop();
				this.logger.log(`Queue stopped and cleaned up for guild ${queue.id}`);
			} catch (error) {
				this.logger.error(
					`Failed to stop queue on disconnect for guild ${queue.id}`,
					error,
				);
			}
		});

		// Handle empty event - when voice channel becomes empty
		// Note: EMPTY event exists but is not in DisTubeEvents type definition
		this.distube.on(Events.EMPTY as any, (queue: Queue) => {
			this.logger.log(
				`Voice channel is empty in guild ${queue.id}, starting 60s timeout`,
			);

			// Wait 60 seconds before leaving
			setTimeout(() => {
				const voiceChannel = queue.voiceChannel;

				// Check if channel still exists and is still empty
				if (!voiceChannel) {
					this.logger.log(
						`Voice channel no longer exists for guild ${queue.id}`,
					);
					return;
				}

				// Count non-bot members in the channel
				const memberCount = voiceChannel.members.filter(
					(member: GuildMember) => !member.user.bot,
				).size;

				if (memberCount === 0) {
					this.logger.log(
						`Voice channel still empty after 60s in guild ${queue.id}, leaving...`,
					);
					try {
						this.distube.voices.leave(queue.id);
						this.logger.log(
							`Left voice channel in guild ${queue.id} due to inactivity`,
						);
					} catch (error) {
						this.logger.error(
							`Failed to leave voice channel for guild ${queue.id}`,
							error,
						);
					}
				} else {
					this.logger.log(
						`Users rejoined voice channel in guild ${queue.id}, staying connected`,
					);
				}
			}, MusicConstants.EMPTY_CHANNEL_TIMEOUT);
		});

		this.logger.log('DisTube event handlers setup completed');
	}

	/**
	 * Handle playback button interactions (Previous, Play/Pause, Stop, Skip, Loop)
	 */
	private async handlePlaybackButtonInteraction(
		interaction: ButtonInteraction,
		queue: Queue,
	): Promise<void> {
		// Validate user is in the same voice channel as the bot
		const member = interaction.guild?.members.cache.get(interaction.user.id);
		const botVoiceChannel = queue.voiceChannel;
		const userVoiceChannel = member?.voice.channel;

		if (!userVoiceChannel || userVoiceChannel.id !== botVoiceChannel?.id) {
			await interaction.reply({
				content: MusicResponse.NOT_IN_SAME_VOICE_CHANNEL,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		try {
			switch (interaction.customId) {
				case 'music_lyrics':
					await this.showLyricsForQueue(interaction, queue);
					return;

				case 'music_refresh':
					await interaction.deferUpdate();
					await this.updateNowPlayingMessage(interaction, queue);
					return;

				case 'music_prev':
					await queue.previous();
					await interaction.reply({
						content: '⏮️ Playing previous song...',
						flags: MessageFlags.Ephemeral,
					});
					break;

				case 'music_play_pause':
					if (queue.paused) {
						await queue.resume();
						await interaction.reply({
							content: '▶️ Resumed playback',
							flags: MessageFlags.Ephemeral,
						});
					} else {
						await queue.pause();
						await interaction.reply({
							content: '⏸️ Paused playback',
							flags: MessageFlags.Ephemeral,
						});
					}
					break;

				case 'music_stop':
					await queue.stop();
					await interaction.reply({
						content: '⏹️ Stopped playback and cleared queue',
						flags: MessageFlags.Ephemeral,
					});
					break;

				case 'music_skip':
					await queue.skip();
					await interaction.reply({
						content: '⏭️ Skipped to next song',
						flags: MessageFlags.Ephemeral,
					});
					break;

				case 'music_loop': {
					// Cycle through repeat modes: 0 (Off) -> 1 (Song) -> 2 (Queue) -> 0
					const currentMode = queue.repeatMode;
					const nextMode = (currentMode + 1) % 3;
					queue.setRepeatMode(nextMode);

					const modeNames = ['Off', 'Song', 'Queue'];
					await interaction.reply({
						content: `🔁 Loop mode: ${modeNames[nextMode]}`,
						flags: MessageFlags.Ephemeral,
					});
					break;
				}

				default:
					await interaction.reply({
						content: '❌ Unknown button action',
						flags: MessageFlags.Ephemeral,
					});
			}

			// Update the original message with new button states
			await this.updateNowPlayingMessage(interaction, queue);
		} catch (error) {
			this.logger.error('Error handling playback button interaction', error);
			await interaction
				.reply({
					content: '❌ Failed to execute playback action',
					flags: MessageFlags.Ephemeral,
				})
				.catch(() => {
					// Interaction might have already been replied to
				});
		}
	}

	/**
	 * Show lyrics for the current queue song from the Now Playing button.
	 */
	private async showLyricsForQueue(
		interaction: ButtonInteraction,
		queue: Queue,
	): Promise<void> {
		await interaction.deferReply({
			flags: MessageFlags.Ephemeral,
		});

		try {
			const currentSong = queue.songs[0];

			if (!currentSong?.name) {
				const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
					'Could not detect current song.',
				);
				await interaction.editReply({ embeds: [errorEmbed] });
				return;
			}

			const lyricsResult = await this.lyricsService.getLyricsForSong(
				currentSong.name,
				currentSong.uploader?.name,
			);
			const chunks = this.lyricsService.splitLyricsIntoChunks(
				lyricsResult.lyrics,
			);

			if (chunks.length === 1) {
				const embed = EmbedBuilderUtils.createLyricsEmbed(
					lyricsResult.title,
					lyricsResult.artist,
					chunks[0],
					lyricsResult.thumbnail,
				);
				await interaction.editReply({ embeds: [embed] });
				return;
			}

			await this.showPaginatedLyrics(interaction, lyricsResult, chunks);
		} catch (error) {
			this.logger.error(
				'Failed to fetch lyrics from Now Playing button',
				error,
			);

			let errorMessage = 'Failed to fetch lyrics. Please try again later.';
			if (
				error instanceof Error &&
				(error.message.includes('No results found') ||
					error.message.includes('not available'))
			) {
				errorMessage = `${error.message}\n\n**Tip:** Try the \`/lyrics\` command with a more specific query.`;
			}

			const errorEmbed = EmbedBuilderUtils.createErrorEmbed(errorMessage);
			await interaction.editReply({ embeds: [errorEmbed] });
		}
	}

	/**
	 * Show paginated lyrics in an ephemeral interaction response.
	 */
	private async showPaginatedLyrics(
		interaction: ButtonInteraction,
		lyricsResult: Awaited<ReturnType<LyricsService['getLyricsForSong']>>,
		chunks: string[],
	): Promise<void> {
		let currentPage = 1;
		const totalPages = chunks.length;
		const customIds = {
			previous: 'nowplaying_lyrics_previous',
			next: 'nowplaying_lyrics_next',
		};

		const initialEmbed = EmbedBuilderUtils.createLyricsEmbed(
			lyricsResult.title,
			lyricsResult.artist,
			chunks[currentPage - 1],
			lyricsResult.thumbnail,
			currentPage,
			totalPages,
		);

		const message = await interaction.editReply({
			embeds: [initialEmbed],
			components: [
				PaginationControlsComponent.create({
					currentPage,
					totalPages,
					customIds,
				}),
			],
		});

		const collector = message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: (buttonInteraction) =>
				buttonInteraction.user.id === interaction.user.id,
			time: 120000,
		});

		collector.on('collect', (buttonInteraction) => {
			if (buttonInteraction.customId === customIds.previous) {
				currentPage = Math.max(1, currentPage - 1);
			} else if (buttonInteraction.customId === customIds.next) {
				currentPage = Math.min(totalPages, currentPage + 1);
			}

			const embed = EmbedBuilderUtils.createLyricsEmbed(
				lyricsResult.title,
				lyricsResult.artist,
				chunks[currentPage - 1],
				lyricsResult.thumbnail,
				currentPage,
				totalPages,
			);

			buttonInteraction
				.update({
					embeds: [embed],
					components: [
						PaginationControlsComponent.create({
							currentPage,
							totalPages,
							customIds,
						}),
					],
				})
				.catch((error) => {
					this.logger.error('Failed to update Now Playing lyrics page', error);
				});
		});

		collector.on('end', () => {
			message.edit({ components: [] }).catch(() => {
				// Message might have been deleted or expired
			});
		});
	}

	/**
	 * Update the Now Playing message with current queue state
	 */
	private async updateNowPlayingMessage(
		interaction: ButtonInteraction,
		queue: Queue,
	): Promise<void> {
		try {
			const embed = EmbedBuilderUtils.createNowPlayingEmbed(
				queue as unknown as QueueLike,
			);
			const buttons = PlaybackControlsComponent.createRows({
				isPaused: queue.paused,
				hasPreviousSongs: queue.previousSongs && queue.previousSongs.length > 0,
				hasNextSongs: queue.songs.length > 1,
			});

			await interaction.message.edit({
				embeds: [embed],
				components: buttons,
			});
		} catch (error) {
			this.logger.error('Failed to update Now Playing message', error);
		}
	}
}
