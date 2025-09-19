import { VolumeDto } from '../dto/music.dto';
import { MusicService } from '../services/music.service';
import { Injectable } from '@nestjs/common';
import { Context, Options, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class VolumeCommand {
	constructor(private readonly musicService: MusicService) {}

	@SlashCommand({
		name: 'volume',
		description: 'Điều chỉnh âm lượng phát nhạc (1-100)',
	})
	public async execute(
		@Context() context: SlashCommandContext,
		@Options() { level }: VolumeDto,
	) {
		const [interaction] = context;

		if (!interaction.isChatInputCommand()) return;

		await interaction.deferReply();

		const result = await this.musicService.setVolume(interaction, level);
		await interaction.editReply({ content: result.message });
	}
}
