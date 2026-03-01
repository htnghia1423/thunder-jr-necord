import { MUSIC_COMMAND_METADATA } from '../../utility/constants/command-metadata';
import { PlayDto } from '../dto/music.dto';
import {
	ExtendedQueue,
	ExtendedSong,
} from '../interfaces/distube-types.interface';
import { PlayResult } from '../interfaces/music.interface';
import { MusicService } from '../services/music.service';
import { EmbedBuilderUtils } from '../utils/embed-builder.utils';
import { Injectable } from '@nestjs/common';
import { type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Context, Options, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class PlayCommand {
	constructor(private readonly musicService: MusicService) {}

	@SlashCommand({
		name: MUSIC_COMMAND_METADATA.play.name,
		description: MUSIC_COMMAND_METADATA.play.description,
	})
	public async execute(
		@Context() context: SlashCommandContext,
		@Options() { song }: PlayDto,
	) {
		const [interaction] = context;

		if (!interaction.isChatInputCommand()) return;

		await interaction.deferReply();

		const result = await this.musicService.play(interaction, song);

		if (!result.success) {
			const errorEmbed = EmbedBuilderUtils.createErrorEmbed(result.message);
			await interaction.editReply({ embeds: [errorEmbed] });
			return;
		}

		await this.handleSuccessfulPlay(interaction, result);
	}

	private async handleSuccessfulPlay(
		interaction: ChatInputCommandInteraction,
		result: PlayResult,
	): Promise<void> {
		// Handle custom messages (from duplicate detection logic)
		if (this.isCustomMessage(result.message)) {
			await interaction.editReply({ content: result.message });
			return;
		}

		// Get the queue to access the actual song object
		const validation = this.musicService.validateGuildAndGetQueue(interaction);

		if (!validation.success) {
			// Fallback to text message if queue not available
			await interaction.editReply({ content: result.message });
			return;
		}

		const { queue } = validation;

		if (result.data?.isPlaylist) {
			await this.handlePlaylistResponse(interaction, result, queue);
		} else {
			await this.handleSingleSongResponse(interaction, result, queue);
		}
	}

	private isCustomMessage(message: string): boolean {
		return (
			message.includes('**Added playlist**') ||
			message.includes('**Skipped**') ||
			message.includes('**Replaced**')
		);
	}

	private async handlePlaylistResponse(
		interaction: ChatInputCommandInteraction,
		result: PlayResult,
		queue: ExtendedQueue,
	): Promise<void> {
		const songsCount = result.data?.songsAdded || 1;
		const currentSong = queue.songs[0];

		if (!currentSong) {
			await interaction.editReply({ content: result.message });
			return;
		}

		// Create embed for playlist
		const embed = new EmbedBuilder()
			.setColor(0x00ff00)
			.setTitle(
				result.data?.isNowPlaying
					? '📋 Now Playing Playlist'
					: '📋 Added Playlist to Queue',
			)
			.setDescription(
				`[${currentSong.name || 'Unknown Song'}](${currentSong.url || ''})`,
			)
			.setTimestamp();

		if (currentSong.thumbnail) {
			embed.setThumbnail(currentSong.thumbnail);
		}

		embed.addFields(
			{
				name: '📊 Songs Added',
				value: `${songsCount} song${songsCount === 1 ? '' : 's'}`,
				inline: true,
			},
			{
				name: '⏱️ First Song Duration',
				value: currentSong.formattedDuration || '00:00',
				inline: true,
			},
		);

		if (currentSong.uploader?.name) {
			embed.addFields({
				name: '👤 Uploader',
				value: currentSong.uploader.name,
				inline: true,
			});
		}

		if (currentSong.user) {
			embed.setFooter({
				text: `Requested by ${currentSong.user.username}`,
				iconURL: currentSong.user.displayAvatarURL(),
			});
		}

		await interaction.editReply({ embeds: [embed] });
	}

	private async handleSingleSongResponse(
		interaction: ChatInputCommandInteraction,
		result: PlayResult,
		queue: ExtendedQueue,
	): Promise<void> {
		// For single songs, find the song in the queue
		let targetSong: ExtendedSong = queue.songs[0]; // Default to current song
		let position: number | undefined;

		// If song was added to queue (not now playing), find it by position
		if (
			!result.data?.isNowPlaying &&
			result.data?.queuePosition !== undefined
		) {
			const queuePos = result.data.queuePosition;
			// The queuePosition in result.data is 0-indexed position in the queue
			// For a newly added song, it should be at the end or near the end
			const actualPosition = queuePos + 1; // Convert to 1-indexed

			// Try to find the song at that position
			if (queue.songs[actualPosition]) {
				targetSong = queue.songs[actualPosition];
				position = actualPosition + 1; // Position for display (1-indexed from user perspective)
			} else {
				// Fallback: use the last song in queue as it was just added
				targetSong = queue.songs.at(-1) as ExtendedSong;
				position = queue.songs.length;
			}
		}

		if (!targetSong) {
			// Fallback to text message
			await interaction.editReply({ content: result.message });
			return;
		}

		// Create embed using the utility
		const embed = EmbedBuilderUtils.createPlayEmbed(targetSong, position);

		// Add duplicate warning if present
		if (result.data?.duplicateWarning) {
			const currentDescription = embed.data.description || '';
			embed.setDescription(
				`${currentDescription}\n\n${result.data.duplicateWarning}`,
			);
		}

		await interaction.editReply({ embeds: [embed] });
	}
}
