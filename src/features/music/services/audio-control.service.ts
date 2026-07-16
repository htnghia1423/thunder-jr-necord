import { LoopMode, LoopModeNames } from '../enums/loop.enum';
import { MusicResponse } from '../enums/music.enum';
import { ExtendedQueue } from '../interfaces/distube-types.interface';
import { MusicOperationResult } from '../interfaces/music.interface';
import { MusicValidationUtils } from '../utils/music-validation.utils';
import { Injectable, Logger } from '@nestjs/common';
import { ChatInputCommandInteraction, VoiceBasedChannel } from 'discord.js';
import { RepeatMode } from 'distube';

import { DisTubeService } from './distube.service';

@Injectable()
export class AudioControlService {
	private readonly logger = new Logger(AudioControlService.name);

	constructor(private readonly distubeService: DisTubeService) {}

	/**
	 * Create a progress bar for now playing
	 */
	createProgressBar(currentTime: number, totalTime: number): string {
		const BAR_LENGTH = 10;

		// Clamp the ratio to [0, 1] and guard a zero/invalid total so a negative
		// or non-finite segment count cannot throw in String.prototype.repeat.
		const ratio =
			Number.isFinite(currentTime) &&
			Number.isFinite(totalTime) &&
			totalTime > 0
				? Math.min(Math.max(currentTime / totalTime, 0), 1)
				: 0;

		const progress = Math.round(ratio * BAR_LENGTH);
		const emptyProgress = BAR_LENGTH - progress;

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
					queue.setVolume(volume);
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

				const { queue } = validation;

				// Set the loop mode (DisTube RepeatMode: 0=OFF, 1=SONG, 2=QUEUE)
				(queue as ExtendedQueue).setRepeatMode(mode as unknown as RepeatMode);

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
