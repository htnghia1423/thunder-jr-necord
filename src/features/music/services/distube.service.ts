/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
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
import { Client } from 'discord.js';
import { DisTube } from 'distube';

/**
 * DisTubeService manages the DisTube instance and handles infrastructure concerns
 * Separated from business logic for better maintainability
 */
@Injectable()
export class DisTubeService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(DisTubeService.name);
	private distube: DisTube;

	constructor(private readonly client: Client) {}

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
		// When a song starts playing - just log, don't send message
		(this.distube as any).on('playSong', (queue: any, song: any) => {
			this.logger.log(`Now playing: ${song.name} in guild ${queue.id}`);
		});

		// When a song is added to queue - just log, don't send message
		(this.distube as any).on('addSong', (queue: any, song: any) => {
			this.logger.log(`Added to queue: ${song.name} in guild ${queue.id}`);
		});

		// When a playlist starts playing - just log, don't send message
		(this.distube as any).on('playList', (queue: any, playlist: any) => {
			this.logger.log(
				`Now playing playlist: ${playlist.name} (${playlist.songs?.length} songs) in guild ${queue.id}`,
			);
		});

		// When a playlist is added to queue - just log, don't send message
		(this.distube as any).on('addList', (queue: any, playlist: any) => {
			this.logger.log(
				`Added playlist to queue: ${playlist.name} (${playlist.songs?.length} songs) in guild ${queue.id}`,
			);
		});

		// When queue ends
		(this.distube as any).on('finish', (queue: any) => {
			this.logger.log(`Queue finished in guild ${queue.id}`);
			const channel = queue.textChannel;
			if (channel) {
				channel.send('🔚 **Queue has ended!**').catch((error: Error) => {
					this.logger.error('Failed to send finish message', error);
				});
			}
		});

		// Handle errors - DisTube v5 signature: (error, queue, song)
		// We only need error and queue, so we omit the song parameter
		(this.distube as any).on('error', (error: Error, queue: any) => {
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
		(this.distube as any).on('disconnect', (queue: any) => {
			this.logger.log(
				`Bot disconnected from voice channel in guild ${queue.id}`,
			);
			try {
				queue.stop();
				this.logger.log(`Queue stopped and cleaned up for guild ${queue.id}`);
			} catch (error) {
				this.logger.error(
					`Failed to stop queue on disconnect for guild ${queue.id}`,
					error,
				);
			}
		});

		// Handle empty event - when voice channel becomes empty
		(this.distube as any).on('empty', (queue: any) => {
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
					(member: any) => !member.user.bot,
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
			}, 60000); // 60 seconds
		});

		this.logger.log('DisTube event handlers setup completed');
	}
}
