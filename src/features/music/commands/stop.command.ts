import { MUSIC_COMMAND_METADATA } from '../../utility/constants/command-metadata';
import { MusicService } from '../services/music.service';
import { Injectable } from '@nestjs/common';
import { Context, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class StopCommand {
	constructor(private readonly musicService: MusicService) {}

	@SlashCommand({
		name: MUSIC_COMMAND_METADATA.stop.name,
		description: MUSIC_COMMAND_METADATA.stop.description,
	})
	public async execute(@Context() context: SlashCommandContext) {
		const [interaction] = context;

		if (!interaction.isChatInputCommand()) return;

		await interaction.deferReply();

		const result = await this.musicService.stop(interaction);
		await interaction.editReply({ content: result.message });
	}
}
