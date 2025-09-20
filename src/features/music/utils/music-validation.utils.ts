import { MusicResponse } from '../enums/music.enum';
import { ChatInputCommandInteraction, VoiceBasedChannel } from 'discord.js';
import { DisTube, Queue } from 'distube';

export interface ValidationResult {
	success: boolean;
	message?: string;
	data?: {
		guildId: string;
		voiceChannel: VoiceBasedChannel;
		queue: Queue;
		distube: DisTube;
	};
}

export class MusicValidationUtils {
	/**
	 * Validate basic music command requirements (guildId, voice channel)
	 */
	static validateBasicRequirements(interaction: ChatInputCommandInteraction): {
		success: boolean;
		message?: string;
		data?: {
			guildId: string;
			voiceChannel: VoiceBasedChannel;
		};
	} {
		const guildId = interaction.guildId;
		if (!guildId) {
			return {
				success: false,
				message: MusicResponse.GENERIC_ERROR,
			};
		}

		const member = interaction.guild?.members.cache.get(interaction.user.id);
		const voiceChannel = member?.voice?.channel as VoiceBasedChannel;

		if (!voiceChannel) {
			return {
				success: false,
				message: MusicResponse.NOT_IN_VOICE_CHANNEL,
			};
		}

		return {
			success: true,
			data: {
				guildId,
				voiceChannel,
			},
		};
	}

	/**
	 * Validate full music command requirements (includes queue check)
	 */
	static validateMusicCommand(
		interaction: ChatInputCommandInteraction,
		distube: DisTube,
	): ValidationResult {
		const basicValidation = this.validateBasicRequirements(interaction);

		if (!basicValidation.success) {
			return {
				success: false,
				message: basicValidation.message,
			};
		}

		const { guildId, voiceChannel } = basicValidation.data!;
		const queue = distube.getQueue(guildId);

		if (!queue) {
			return {
				success: false,
				message: MusicResponse.NO_QUEUE,
			};
		}

		return {
			success: true,
			data: {
				guildId,
				voiceChannel,
				queue,
				distube,
			},
		};
	}
}
