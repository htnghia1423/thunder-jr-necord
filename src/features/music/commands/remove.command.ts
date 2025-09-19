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
		description: 'Song position in queue (position number)',
		required: false,
	})
	position?: number;

	@StringOption({
		name: 'song_name',
		description: 'Song name to remove (fuzzy search)',
		required: false,
	})
	songName?: string;
}

@Injectable()
export class RemoveCommand {
	constructor(private readonly musicService: MusicService) {}

	@SlashCommand({
		name: 'remove',
		description: '🗑️ Remove song from queue by position or name',
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
					'❌ **Error:** Please provide either position or song name to remove.',
			});
			return;
		}

		const result = await this.musicService.removeSong(interaction, dto);

		if (result.success) {
			const { songName, position, method } = result.data || {};
			const methodText = method === 'position' ? 'by position' : 'by name';

			await interaction.editReply({
				content: `🗑️ **Removed song ${methodText}:**\n🎵 **${songName}** (position #${position})\n👤 **Requested by:** <@${interaction.user.id}>`,
			});
		} else {
			await interaction.editReply({
				content: `❌ **${result.message}**`,
			});
		}
	}
}
