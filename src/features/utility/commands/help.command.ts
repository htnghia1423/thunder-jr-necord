import { Injectable } from '@nestjs/common';
import { EmbedBuilder } from 'discord.js';
import { Context, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class HelpCommand {
	@SlashCommand({
		name: 'help',
		description: 'Show all available bot commands and their descriptions',
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
			.setColor('#0099ff')
			.setTitle('🤖 Thunder Jr Bot - Help Center')
			.setDescription(
				'Welcome to Thunder Jr! Here are all available commands organized by category.',
			)
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
				text: 'Use the commands below to see detailed help for each category',
			});

		// Music commands embed
		const musicEmbed = new EmbedBuilder()
			.setColor('#ff6b6b')
			.setTitle('🎵 Music Commands')
			.setDescription('Control your music playback with these commands:')
			.addFields(
				{
					name: '🎶 `/play <song>`',
					value:
						'Play music from URL or search keywords\n`/play song: Imagine Dragons`',
					inline: false,
				},
				{
					name: '⏭️ `/skip`',
					value: 'Skip the current song',
					inline: true,
				},
				{
					name: '⏹️ `/stop`',
					value: 'Stop playback and clear queue',
					inline: true,
				},
				{
					name: '📋 `/queue`',
					value: 'Show current music queue',
					inline: true,
				},
				{
					name: '🎵 `/nowplaying`',
					value: 'Show current song info',
					inline: true,
				},
				{
					name: '🔊 `/volume <level>`',
					value: 'Set volume (1-100)\n`/volume level: 50`',
					inline: true,
				},
				{
					name: '❌ `/remove <position|name>`',
					value: 'Remove song from queue\n`/remove position: 3`',
					inline: true,
				},
				{
					name: '🔄 `/loop [mode]`',
					value: 'Toggle loop: OFF/SONG/QUEUE\n`/loop mode: song`',
					inline: true,
				},
				{
					name: '🔀 `/shuffle`',
					value: 'Randomly shuffle queue order',
					inline: true,
				},
			)
			.setFooter({
				text: '💡 You must be in a voice channel to use music commands',
			});

		// Utility commands embed
		const utilityEmbed = new EmbedBuilder()
			.setColor('#4ecdc4')
			.setTitle('🛠️ Utility Commands')
			.setDescription('General bot utilities and information:')
			.addFields(
				{
					name: '🏓 `/ping`',
					value: 'Check bot latency and responsiveness',
					inline: true,
				},
				{
					name: '❓ `/help`',
					value: 'Show this help message',
					inline: true,
				},
			);

		// Tips embed
		const tipsEmbed = new EmbedBuilder()
			.setColor('#95e1d3')
			.setTitle('🔗 Important Notes & Tips')
			.setDescription('Here are some helpful tips for using the bot:')
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
