import { MUSIC_COMMAND_METADATA } from '../../utility/constants/command-metadata';
import { MusicService } from '../services/music.service';
import { Injectable } from '@nestjs/common';
import { Context, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class ShuffleCommand {
	constructor(private readonly musicService: MusicService) {}

	@SlashCommand({
		name: MUSIC_COMMAND_METADATA.shuffle.name,
		description: MUSIC_COMMAND_METADATA.shuffle.description,
	})
	public async execute(@Context() context: SlashCommandContext) {
		const [interaction] = context;

		if (!interaction.isChatInputCommand()) return;

		// Defer reply to prevent timeout
		await interaction.deferReply();

		// Delegate to MusicService
		const result = await this.musicService.shuffle(interaction);

		await interaction.editReply({ content: result.message });
	}
}
