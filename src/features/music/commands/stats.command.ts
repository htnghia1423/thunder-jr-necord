import { MusicStatsService } from '../services/music-stats.service';
import { EmbedBuilderUtils } from '../utils/embed-builder.utils';
import { Injectable, Logger } from '@nestjs/common';
import type { SlashCommandContext } from 'necord';
import { Context, Subcommand } from 'necord';

/**
 * Stats Command - Displays music playback statistics
 * Provides two subcommands:
 * - /stats server: Server-wide statistics (public)
 * - /stats me: Personal statistics (ephemeral/private)
 */
@Injectable()
export class StatsCommand {
	private readonly logger = new Logger(StatsCommand.name);

	constructor(private readonly musicStatsService: MusicStatsService) {}

	/**
	 * Display server-wide music statistics
	 * Shows top 10 songs and top 5 DJs
	 * Response is public
	 */
	@Subcommand({
		name: 'stats server',
		description: 'View server music statistics',
	})
	public async server(@Context() context: SlashCommandContext) {
		const [interaction] = context;
		if (!interaction.isChatInputCommand()) return;

		await interaction.deferReply({ ephemeral: false });

		try {
			const guildId = interaction.guildId;
			if (!guildId) {
				const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
					'This command can only be used in a server.',
				);
				await interaction.editReply({ embeds: [errorEmbed] });
				return;
			}

			// Fetch server stats
			const stats = await this.musicStatsService.getServerStats(guildId);

			// Check if there are any stats to display
			if (stats.totalPlays === 0) {
				const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
					'No music has been played in this server yet. Start listening to some tunes!',
				);
				await interaction.editReply({ embeds: [errorEmbed] });
				return;
			}

			// Resolve Discord usernames for top DJs
			// Only fetch for users that exist in the stats
			for (const dj of stats.topDJs) {
				try {
					const user = await interaction.client.users.fetch(dj.userId);
					dj.username = user.username;
				} catch {
					// If user fetch fails, use a placeholder
					this.logger.warn(
						`Failed to fetch user ${dj.userId} for stats display`,
					);
					dj.username = 'Unknown User';
				}
			}

			// Create and send stats embed
			const embed = EmbedBuilderUtils.createServerStatsEmbed(stats);
			await interaction.editReply({ embeds: [embed] });

			this.logger.log(
				`Server stats displayed for guild ${guildId} (${stats.totalPlays} total plays)`,
			);
		} catch (error) {
			this.logger.error('Failed to fetch server stats:', error);
			const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
				'Failed to fetch server statistics. Please try again later.',
			);
			await interaction.editReply({ embeds: [errorEmbed] });
		}
	}

	/**
	 * Display user's personal music statistics
	 * Shows user's top 10 songs and rank
	 * Response is ephemeral (private)
	 */
	@Subcommand({
		name: 'stats me',
		description: 'View your personal music statistics',
	})
	public async me(@Context() context: SlashCommandContext) {
		const [interaction] = context;
		if (!interaction.isChatInputCommand()) return;

		await interaction.deferReply({ ephemeral: true });

		try {
			const guildId = interaction.guildId;
			const userId = interaction.user.id;
			const username = interaction.user.username;

			if (!guildId) {
				const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
					'This command can only be used in a server.',
				);
				await interaction.editReply({ embeds: [errorEmbed] });
				return;
			}

			// Fetch user stats
			const stats = await this.musicStatsService.getUserStats(guildId, userId);

			// Check if user has any stats
			if (stats.totalPlays === 0) {
				const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
					"You haven't played any music yet! Use `/play` to start listening.",
				);
				await interaction.editReply({ embeds: [errorEmbed] });
				return;
			}

			// Create and send stats embed
			const embed = EmbedBuilderUtils.createUserStatsEmbed(stats, username);
			await interaction.editReply({ embeds: [embed] });

			this.logger.log(
				`User stats displayed for ${username} (${userId}) in guild ${guildId} (${stats.totalPlays} plays)`,
			);
		} catch (error) {
			this.logger.error('Failed to fetch user stats:', error);
			const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
				'Failed to fetch your statistics. Please try again later.',
			);
			await interaction.editReply({ embeds: [errorEmbed] });
		}
	}
}
