import { MusicService } from '../services/music.service';
import { Injectable } from '@nestjs/common';
import { Context, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class StopCommand {
	constructor(private readonly musicService: MusicService) {}

	@SlashCommand({
		name: 'stop',
		description: 'Stop music playback and clear queue',
	})
	public async execute(@Context() context: SlashCommandContext) {
		const [interaction] = context;

		if (!interaction.isChatInputCommand()) return;

		await interaction.deferReply();

		const result = await this.musicService.stop(interaction);
		await interaction.editReply({ content: result.message });
	}
}
