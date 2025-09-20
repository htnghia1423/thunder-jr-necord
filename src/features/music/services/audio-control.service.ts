import { LoopMode, LoopModeNames } from '../enums/loop.enum';
import { MusicResponse } from '../enums/music.enum';
import { ExtendedQueue } from '../interfaces/distube-types.interface';
import { MusicOperationResult } from '../interfaces/music.interface';
import { Injectable, Logger } from '@nestjs/common';
import { ChatInputCommandInteraction, VoiceBasedChannel } from 'discord.js';
import { RepeatMode } from 'distube';

import { DisTubeService } from './distube.service';

@Injectable()
export class AudioControlService {
	private readonly logger = new Logger(AudioControlService.name);

	constructor(private readonly distubeService: DisTubeService) {}

	/**
	 * Validate guild and get queue for music operations
	 */
	private validateGuildAndGetQueue(
		interaction: ChatInputCommandInteraction,
	):
		| { success: true; queue: ExtendedQueue }
		| { success: false; message: string } {
		const guildId = interaction.guildId;
		if (!guildId) {
			return {
				success: false,
				message: MusicResponse.GENERIC_ERROR,
			};
		}

		const distube = this.distubeService.getDistube();
		const queue = distube.getQueue(guildId) as ExtendedQueue | null;

		if (!queue) {
			return {
				success: false,
				message: MusicResponse.NO_QUEUE,
			};
		}

		return {
			success: true,
			queue,
		};
	}

	/**
	 * Create a progress bar for now playing
	 */
	createProgressBar(currentTime: number, totalTime: number): string {
		const progress = Math.round((currentTime / totalTime) * 10);
		const emptyProgress = 10 - progress;

		const progressChars = '▓'.repeat(progress);
		const emptyProgressChars = '░'.repeat(emptyProgress);

		return `${progressChars}${emptyProgressChars}`;
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
	 * Set loop mode for the queue
	 */
	setLoop(
		interaction: ChatInputCommandInteraction,
		mode: LoopMode,
	): Promise<MusicOperationResult> {
		return new Promise((resolve) => {
			try {
				const validation = this.validateGuildAndGetQueue(interaction);

				if (!validation.success) {
					resolve({
						success: false,
						message: validation.message,
					});
					return;
				}

				const { queue } = validation;

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
}
