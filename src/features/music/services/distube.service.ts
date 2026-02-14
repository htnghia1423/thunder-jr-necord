/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { SoundCloudPlugin } from '@distube/soundcloud';
import { SpotifyPlugin } from '@distube/spotify';
import { YouTubePlugin } from '@distube/youtube';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'discord.js';
import { DisTube } from 'distube';

/**
 * DisTubeService manages the DisTube instance and handles infrastructure concerns
 * Separated from business logic for better maintainability
 */
@Injectable()
export class DisTubeService implements OnModuleInit {
	private readonly logger = new Logger(DisTubeService.name);
	private distube: DisTube;

	constructor(private readonly client: Client) {}

	onModuleInit() {
		this.initializeDistube();
		this.setupEventHandlers();
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
					// TODO: Add your YouTube cookies here to bypass age/region restrictions
					// Instructions: Export cookies from browser using a cookie extension in Netscape format
					new YouTubePlugin({
						cookies: [], // Paste cookie array here when ready
					}),
					new SpotifyPlugin(),
					new SoundCloudPlugin(),
				],
			});

			this.logger.log('DisTube initialized successfully with plugins');
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

		this.logger.log('DisTube event handlers setup completed');
	}
}
