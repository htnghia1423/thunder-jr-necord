import { MusicService } from '../services/music.service';
import { Injectable } from '@nestjs/common';
import { Context, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class SkipCommand {
	constructor(private readonly musicService: MusicService) {}

	@SlashCommand({
		name: 'skip',
		description: 'Skip the current song',
	})
	public async execute(@Context() context: SlashCommandContext) {
		const [interaction] = context;

		if (!interaction.isChatInputCommand()) return;

		await interaction.deferReply();

		const result = await this.musicService.skip(interaction);
		await interaction.editReply({ content: result.message });
	}
}
