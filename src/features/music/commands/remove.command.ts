import { MusicService } from '../services/music.service';
import { Injectable } from '@nestjs/common';
import {
	Context,
	NumberOption,
	Options,
	SlashCommand,
	StringOption,
} from 'necord';
import type { SlashCommandContext } from 'necord';

export class RemoveDto {
	@NumberOption({
		name: 'position',
		description: 'Vị trí bài hát trong queue (số thứ tự)',
		required: false,
	})
	position?: number;

	@StringOption({
		name: 'song_name',
		description: 'Tên bài hát cần xóa (tìm kiếm gần đúng)',
		required: false,
	})
	songName?: string;
}

@Injectable()
export class RemoveCommand {
	constructor(private readonly musicService: MusicService) {}

	@SlashCommand({
		name: 'remove',
		description: '🗑️ Xóa bài hát khỏi hàng đợi theo vị trí hoặc tên bài',
	})
	public async execute(
		@Context() context: SlashCommandContext,
		@Options() dto: RemoveDto,
	): Promise<void> {
		const [interaction] = context;
		await interaction.deferReply();

		// Validate that at least one parameter is provided
		if (!dto.position && !dto.songName) {
			await interaction.editReply({
				content:
					'❌ **Lỗi:** Vui lòng cung cấp vị trí hoặc tên bài hát để xóa.',
			});
			return;
		}

		const result = await this.musicService.removeSong(interaction, dto);

		if (result.success) {
			const { songName, position, method } = result.data || {};
			const methodText = method === 'position' ? 'theo vị trí' : 'theo tên';

			await interaction.editReply({
				content: `🗑️ **Đã xóa bài hát ${methodText}:**\n🎵 **${songName}** (vị trí #${position})\n👤 **Yêu cầu bởi:** <@${interaction.user.id}>`,
			});
		} else {
			await interaction.editReply({
				content: `❌ **${result.message}**`,
			});
		}
	}
}
