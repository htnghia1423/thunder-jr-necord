import { UTILITY_COMMAND_METADATA } from '../constants/command-metadata';
import {
	HELP_CONSTANTS,
	MUSIC_COMMANDS,
	UTILITY_COMMANDS,
} from '../constants/help.constants';
import { Injectable } from '@nestjs/common';
import { EmbedBuilder } from 'discord.js';
import { Context, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class HelpCommand {
	@SlashCommand({
		name: UTILITY_COMMAND_METADATA.help.name,
		description: UTILITY_COMMAND_METADATA.help.description,
	})
	public async execute(@Context() context: SlashCommandContext) {
		const [interaction] = context;

		if (!interaction.isChatInputCommand()) return;

		await interaction.deferReply();

		const embeds = this.generateHelpEmbeds();
		await interaction.editReply({ embeds });
	}

	private generateHelpEmbeds(): EmbedBuilder[] {
		// Main overview embed
		const mainEmbed = new EmbedBuilder()
			.setColor(HELP_CONSTANTS.COLORS.MAIN)
			.setTitle(HELP_CONSTANTS.TITLES.MAIN)
			.setDescription(HELP_CONSTANTS.DESCRIPTIONS.MAIN)
			.addFields(
				{
					name: '🎵 Music Commands',
					value: 'Control music playback and queue management',
					inline: true,
				},
				{
					name: '🛠️ Utility Commands',
					value: 'General bot utilities and information',
					inline: true,
				},
				{
					name: '💡 Quick Start',
					value:
						'Use `/play <song>` to start!\nType `/` to see all commands with auto-complete.',
					inline: false,
				},
			)
			.setFooter({
				text: HELP_CONSTANTS.FOOTERS.MAIN,
			});

		// Music commands embed
		const musicEmbed = new EmbedBuilder()
			.setColor(HELP_CONSTANTS.COLORS.MUSIC)
			.setTitle(HELP_CONSTANTS.TITLES.MUSIC)
			.setDescription(HELP_CONSTANTS.DESCRIPTIONS.MUSIC)
			.addFields(MUSIC_COMMANDS)
			.setFooter({
				text: HELP_CONSTANTS.FOOTERS.MUSIC,
			});

		// Utility commands embed
		const utilityEmbed = new EmbedBuilder()
			.setColor(HELP_CONSTANTS.COLORS.UTILITY)
			.setTitle(HELP_CONSTANTS.TITLES.UTILITY)
			.setDescription(HELP_CONSTANTS.DESCRIPTIONS.UTILITY)
			.addFields(UTILITY_COMMANDS);

		// Tips embed
		const tipsEmbed = new EmbedBuilder()
			.setColor(HELP_CONSTANTS.COLORS.TIPS)
			.setTitle(HELP_CONSTANTS.TITLES.TIPS)
			.setDescription(HELP_CONSTANTS.DESCRIPTIONS.TIPS)
			.addFields(
				{
					name: '🎯 Music Sources',
					value:
						'✅ YouTube URLs and searches\n✅ Spotify URLs\n✅ SoundCloud URLs\n✅ Playlist URLs (adds all songs)',
					inline: true,
				},
				{
					name: '📝 Pro Tips',
					value:
						'• Use keywords instead of URLs for easy searching\n• Playlist URLs add all songs to queue\n• Use `/remove` to see numbered queue positions\n• Type `/` for command auto-complete',
					inline: true,
				},
				{
					name: '🎙️ Voice Channel',
					value:
						'You **must** be in a voice channel to use music commands. The bot will join your channel automatically!',
					inline: false,
				},
			);

		return [mainEmbed, musicEmbed, utilityEmbed, tipsEmbed];
	}
}
