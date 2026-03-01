import { LoopMode } from '../enums/loop.enum';
import { ExtendedQueue } from '../interfaces/distube-types.interface';
import {
	MusicOperationResult,
	PlayResult,
	QueueResult,
	SkipResult,
} from '../interfaces/music.interface';
import { Injectable, Logger } from '@nestjs/common';
import { ChatInputCommandInteraction } from 'discord.js';

import { AudioControlService } from './audio-control.service';
import { DisTubeService } from './distube.service';
import { PlayMusicService } from './play-music.service';
import { QueueManagementService } from './queue-management.service';

@Injectable()
export class MusicService {
	private readonly logger = new Logger(MusicService.name);

	constructor(
		private readonly distubeService: DisTubeService,
		private readonly playMusicService: PlayMusicService,
		private readonly queueManagementService: QueueManagementService,
		private readonly audioControlService: AudioControlService,
	) {}

	/**
	 * Validate guild and get queue for music operations
	 */
	validateGuildAndGetQueue(
		interaction: ChatInputCommandInteraction,
	):
		| { success: true; queue: ExtendedQueue }
		| { success: false; message: string } {
		const guildId = interaction.guildId;
		if (!guildId) {
			return {
				success: false,
				message: 'Guild ID not found',
			};
		}

		const distube = this.distubeService.getDistube();
		const queue = distube.getQueue(guildId);

		if (!queue) {
			return {
				success: false,
				message: 'No music queue found',
			};
		}

		return {
			success: true,
			queue: queue as unknown as ExtendedQueue,
		};
	}

	// Delegate to PlayMusicService
	async play(
		interaction: ChatInputCommandInteraction,
		query: string,
	): Promise<PlayResult> {
		return this.playMusicService.play(interaction, query);
	}

	// Delegate to QueueManagementService
	async skip(interaction: ChatInputCommandInteraction): Promise<SkipResult> {
		return this.queueManagementService.skip(interaction);
	}

	async stop(
		interaction: ChatInputCommandInteraction,
	): Promise<MusicOperationResult> {
		return this.queueManagementService.stop(interaction);
	}

	getQueue(interaction: ChatInputCommandInteraction): Promise<QueueResult> {
		return this.queueManagementService.getQueue(interaction);
	}

	getNowPlaying(
		interaction: ChatInputCommandInteraction,
	): Promise<QueueResult> {
		const progressBarFn = (currentTime: number, totalTime: number): string =>
			this.audioControlService.createProgressBar(currentTime, totalTime);

		return this.queueManagementService.getNowPlaying(
			interaction,
			progressBarFn,
		);
	}

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
		return this.queueManagementService.removeSong(interaction, options);
	}

	async shuffle(
		interaction: ChatInputCommandInteraction,
	): Promise<MusicOperationResult> {
		return this.queueManagementService.shuffle(interaction);
	}

	// Delegate to AudioControlService
	async setVolume(
		interaction: ChatInputCommandInteraction,
		volume: number,
	): Promise<MusicOperationResult> {
		return this.audioControlService.setVolume(interaction, volume);
	}

	setLoop(
		interaction: ChatInputCommandInteraction,
		mode: LoopMode,
	): Promise<MusicOperationResult> {
		return this.audioControlService.setLoop(interaction, mode);
	}
}
