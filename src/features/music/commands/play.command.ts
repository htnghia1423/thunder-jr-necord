import { PlayDto } from '../dto/music.dto';
import { MusicService } from '../services/music.service';
import { DiscordUtils } from '../utils/discord.utils';
import { Injectable } from '@nestjs/common';
import { Context, Options, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class PlayCommand {
	constructor(private readonly musicService: MusicService) {}

	@SlashCommand({
		name: 'play',
		description: 'Phát nhạc từ YouTube URL hoặc tìm kiếm theo từ khóa',
	})
	public async execute(
		@Context() context: SlashCommandContext,
		@Options() { song }: PlayDto,
	) {
		const [interaction] = context;

		if (!interaction.isChatInputCommand()) return;

		// Defer reply to prevent timeout
		await interaction.deferReply();

		// Delegate to MusicService
		const result = await this.musicService.play(interaction, song);

		if (result.success) {
			// Check if this was a playlist or single song
			const songName = DiscordUtils.formatSongName(
				result.data?.songName || song,
			);
			const duration = result.data?.duration
				? DiscordUtils.formatDuration(result.data.duration)
				: '';
			const durationText = duration ? `⏱️ **Thời lượng:** ${duration}\n` : '';

			// Check if this is a custom message from playlist duplicate handling
			const isCustomMessage =
				result.message.includes('**Đã thêm playlist**') ||
				result.message.includes('**Đã bỏ qua**') ||
				result.message.includes('**Đã thay thế**');

			if (isCustomMessage) {
				// Use the custom message from playlist duplicate handling
				await interaction.editReply({
					content: result.message,
				});
				return;
			}

			if (result.data?.isPlaylist) {
				// Handle playlist
				const songsCount = result.data.songsAdded || 1;

				if (result.data?.isNowPlaying) {
					// Playlist started playing immediately
					await interaction.editReply({
						content: `📋 **Đang phát playlist:** ${songsCount} bài hát\n🎵 **Bài đầu tiên:** ${songName}\n${durationText}👤 **Yêu cầu bởi:** <@${interaction.user.id}>`,
					});
				} else {
					// Playlist added to queue
					await interaction.editReply({
						content: `📋 **Đã thêm playlist vào hàng đợi:** ${songsCount} bài hát\n🎵 **Bài đầu tiên:** ${songName}\n${durationText}👤 **Yêu cầu bởi:** <@${interaction.user.id}>`,
					});
				}
			} else {
				// Handle single song (existing logic)
				if (result.data?.isNowPlaying) {
					// Song is now playing (queue was empty)
					await interaction.editReply({
						content: `🎵 **Đang phát:** ${songName}\n${durationText}👤 **Yêu cầu bởi:** <@${interaction.user.id}>`,
					});
				} else {
					// Song added to queue
					const position = result.data?.queuePosition
						? ` (vị trí #${result.data.queuePosition + 1})`
						: '';
					const duplicateWarning = result.data?.duplicateWarning || '';

					await interaction.editReply({
						content: `✅ **Đã thêm vào hàng đợi:** ${songName}${position}\n${durationText}👤 **Yêu cầu bởi:** <@${interaction.user.id}>${duplicateWarning}`,
					});
				}
			}
		} else {
			await interaction.editReply({ content: result.message });
		}
	}
}
