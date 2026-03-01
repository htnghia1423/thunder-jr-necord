import { MUSIC_COMMAND_METADATA } from '../../utility/constants/command-metadata';
import { MusicService } from '../services/music.service';
import { EmbedBuilderUtils } from '../utils/embed-builder.utils';
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

		// Validate guild and get queue
		const validation = this.musicService.validateGuildAndGetQueue(interaction);

		if (!validation.success) {
			const errorEmbed = EmbedBuilderUtils.createErrorEmbed(validation.message);
			await interaction.editReply({ embeds: [errorEmbed] });
			return;
		}

		const { queue } = validation;

		// Create and send embed
		const embed = EmbedBuilderUtils.createNowPlayingEmbed(queue);
		await interaction.editReply({ embeds: [embed] });
	}
}
