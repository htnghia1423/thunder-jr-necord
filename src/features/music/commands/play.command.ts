import { MUSIC_COMMAND_METADATA } from '../../utility/constants/command-metadata';
import { PlayDto } from '../dto/music.dto';
import { PlayResult } from '../interfaces/music.interface';
import { MusicService } from '../services/music.service';
import { DiscordUtils } from '../utils/discord.utils';
import { Injectable } from '@nestjs/common';
import { type ChatInputCommandInteraction } from 'discord.js';
import { Context, Options, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

interface SongData {
	songName: string;
	durationText: string;
}

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

		// Provide user feedback when fetching YouTube playlists
		if (song.includes('youtube.com') && song.includes('list=')) {
			await interaction.editReply({
				content:
					'⏳ Fetching playlist via YouTube API. Please wait a moment...',
			});
		}

		const result = await this.musicService.play(interaction, song);

		if (!result.success) {
			await interaction.editReply({ content: result.message });
			return;
		}

		await this.handleSuccessfulPlay(interaction, result, song);
	}

	private async handleSuccessfulPlay(
		interaction: ChatInputCommandInteraction,
		result: PlayResult,
		song: string,
	): Promise<void> {
		const songData = this.prepareSongData(result, song);

		if (this.isCustomMessage(result.message)) {
			await interaction.editReply({ content: result.message });
			return;
		}

		if (result.data?.isPlaylist) {
			await this.handlePlaylistResponse(interaction, result, songData);
		} else {
			await this.handleSingleSongResponse(interaction, result, songData);
		}
	}

	private prepareSongData(result: PlayResult, song: string): SongData {
		const songName = DiscordUtils.formatSongName(result.data?.songName || song);
		const duration = result.data?.duration
			? DiscordUtils.formatDuration(result.data.duration)
			: '';
		const durationText = duration ? `⏱️ **Duration:** ${duration}\n` : '';

		return { songName, durationText };
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
		songData: SongData,
	): Promise<void> {
		const songsCount = result.data?.songsAdded || 1;
		const { songName, durationText } = songData;

		const baseContent = `🎵 **First song:** ${songName}\n${durationText}👤 **Requested by:** <@${interaction.user.id}>`;

		if (result.data?.isNowPlaying) {
			await interaction.editReply({
				content: `📋 **Now playing playlist:** ${songsCount} songs\n${baseContent}`,
			});
		} else {
			await interaction.editReply({
				content: `📋 **Added playlist to queue:** ${songsCount} songs\n${baseContent}`,
			});
		}
	}

	private async handleSingleSongResponse(
		interaction: ChatInputCommandInteraction,
		result: PlayResult,
		songData: SongData,
	): Promise<void> {
		const { songName, durationText } = songData;
		const userMention = `👤 **Requested by:** <@${interaction.user.id}>`;

		if (result.data?.isNowPlaying) {
			await interaction.editReply({
				content: `🎵 **Now Playing:** ${songName}\n${durationText}${userMention}`,
			});
		} else {
			const position = result.data?.queuePosition
				? ` (position #${result.data.queuePosition + 1})`
				: '';
			const duplicateWarning = result.data?.duplicateWarning || '';

			await interaction.editReply({
				content: `✅ **Added to queue:** ${songName}${position}\n${durationText}${userMention}${duplicateWarning}`,
			});
		}
	}
}
