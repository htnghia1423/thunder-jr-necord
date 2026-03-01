import { MusicResponse } from '../enums/music.enum';
import {
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	VoiceBasedChannel,
} from 'discord.js';
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
	 * Validate bot has necessary permissions in voice channel
	 */
	static validateBotVoicePermissions(voiceChannel: VoiceBasedChannel): {
		valid: boolean;
		message?: string;
	} {
		const permissions = voiceChannel.permissionsFor(
			voiceChannel.guild.members.me!,
		);

		if (!permissions) {
			return {
				valid: false,
				message: MusicResponse.BOT_NO_PERMISSIONS,
			};
		}

		const hasConnect = permissions.has(PermissionFlagsBits.Connect);
		const hasSpeak = permissions.has(PermissionFlagsBits.Speak);

		if (!hasConnect || !hasSpeak) {
			return {
				valid: false,
				message: MusicResponse.BOT_NO_PERMISSIONS,
			};
		}

		return {
			valid: true,
		};
	}

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

		// Validate bot permissions before proceeding
		const permissionValidation = this.validateBotVoicePermissions(voiceChannel);
		if (!permissionValidation.valid) {
			return {
				success: false,
				message: permissionValidation.message,
			};
		}

		const queue = distube.getQueue(voiceChannel.guild);

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

	/**
	 * Validate guild and get queue for basic queue operations
	 */
	static validateGuildAndGetQueue(
		interaction: ChatInputCommandInteraction,
		distube: DisTube,
	): { success: true; queue: Queue } | { success: false; message: string } {
		const guild = interaction.guild;
		if (!guild) {
			return {
				success: false,
				message: MusicResponse.GENERIC_ERROR,
			};
		}

		const queue = distube.getQueue(guild);

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
}
