import { MusicService } from '../services/music.service';
import { Injectable } from '@nestjs/common';
import { Context, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class NowPlayingCommand {
	constructor(private readonly musicService: MusicService) {}

	@SlashCommand({
		name: 'nowplaying',
		description: 'Show currently playing song information',
	})
	public async execute(@Context() context: SlashCommandContext) {
		const [interaction] = context;

		if (!interaction.isChatInputCommand()) return;

		await interaction.deferReply();

		const result = await this.musicService.getNowPlaying(interaction);
		await interaction.editReply({ content: result.message });
	}
}
