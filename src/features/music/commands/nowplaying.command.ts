import { MUSIC_COMMAND_METADATA } from '../../utility/constants/command-metadata';
import { MusicService } from '../services/music.service';
import { Injectable } from '@nestjs/common';
import { Context, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class NowPlayingCommand {
	constructor(private readonly musicService: MusicService) {}

	@SlashCommand({
		name: MUSIC_COMMAND_METADATA.nowplaying.name,
		description: MUSIC_COMMAND_METADATA.nowplaying.description,
	})
	public async execute(@Context() context: SlashCommandContext) {
		const [interaction] = context;

		if (!interaction.isChatInputCommand()) return;

		await interaction.deferReply();

		const result = await this.musicService.getNowPlaying(interaction);
		await interaction.editReply({ content: result.message });
	}
}
