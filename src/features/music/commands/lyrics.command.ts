import { MUSIC_COMMAND_METADATA } from '../../utility/constants/command-metadata';
import { PaginationControlsComponent } from '../components/pagination-controls.component';
import { LyricsDto } from '../dto/lyrics.dto';
import { DisTubeService } from '../services/distube.service';
import {
	LyricsNotFoundError,
	LyricsResult,
	LyricsService,
} from '../services/lyrics.service';
import { MusicService } from '../services/music.service';
import { EmbedBuilderUtils } from '../utils/embed-builder.utils';
import { Injectable, Logger } from '@nestjs/common';
import { ComponentType } from 'discord.js';
import { Context, Options, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

/**
 * LyricsCommand handles the /lyrics slash command
 * Features:
 * - Auto-detection of current playing song
 * - Manual search with query parameter
 * - Pagination for long lyrics
 * - Advanced title cleaning for better search results
 */
@Injectable()
export class LyricsCommand {
	private readonly logger = new Logger(LyricsCommand.name);
	private readonly COLLECTOR_TIMEOUT = 120000; // 2 minutes

	constructor(
		private readonly lyricsService: LyricsService,
		private readonly musicService: MusicService,
		private readonly disTubeService: DisTubeService,
	) {}

	@SlashCommand({
		name: MUSIC_COMMAND_METADATA.lyrics.name,
		description: MUSIC_COMMAND_METADATA.lyrics.description,
	})
	public async execute(
		@Context() context: SlashCommandContext,
		@Options() dto: LyricsDto,
	) {
		const [interaction] = context;

		if (!interaction.isChatInputCommand()) return;

		// Defer reply immediately as lyrics fetching can take time
		await interaction.deferReply();

		try {
			// Determine search query or current song metadata
			let lyricsResult: LyricsResult;

			// If no query provided, try to get current playing song
			if (dto.query) {
				lyricsResult = await this.lyricsService.getLyrics(dto.query);
			} else {
				this.logger.log(
					'No query provided, attempting to auto-detect current song',
				);

				const validation =
					this.musicService.validateGuildAndGetQueue(interaction);

				if (!validation.success) {
					const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
						'❌ No song is currently playing. Please provide a song name using the `query` parameter.\n\n**Example:** `/lyrics query: Bohemian Rhapsody`',
					);
					await interaction.editReply({ embeds: [errorEmbed] });
					return;
				}

				const { queue } = validation;
				const currentSong = queue.songs[0];

				if (!currentSong || !currentSong.name) {
					const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
						'❌ Could not detect current song. Please provide a song name using the `query` parameter.',
					);
					await interaction.editReply({ embeds: [errorEmbed] });
					return;
				}

				lyricsResult = await this.lyricsService.getLyricsForSong(
					currentSong.name,
					currentSong.uploader?.name,
				);
				this.logger.log(
					`Auto-detected song: "${currentSong.uploader?.name || 'Unknown artist'} - ${currentSong.name}"`,
				);
			}

			// Split lyrics into chunks for pagination
			const chunks = this.lyricsService.splitLyricsIntoChunks(
				lyricsResult.lyrics,
			);
			const totalPages = chunks.length;

			this.logger.log(
				`Retrieved lyrics for "${lyricsResult.title}" - ${totalPages} page(s)`,
			);

			// If only one page, display without pagination controls
			if (totalPages === 1) {
				const embed = EmbedBuilderUtils.createLyricsEmbed(
					lyricsResult.title,
					lyricsResult.artist,
					chunks[0],
					lyricsResult.thumbnail,
				);

				await interaction.editReply({ embeds: [embed] });
				return;
			}

			// Multiple pages - display with pagination controls
			let currentPage = 1;

			const initialEmbed = EmbedBuilderUtils.createLyricsEmbed(
				lyricsResult.title,
				lyricsResult.artist,
				chunks[currentPage - 1],
				lyricsResult.thumbnail,
				currentPage,
				totalPages,
			);

			const message = await interaction.editReply({
				embeds: [initialEmbed],
				components: [
					PaginationControlsComponent.create({
						currentPage,
						totalPages,
						customIds: {
							previous: 'lyrics_previous',
							next: 'lyrics_next',
						},
					}),
				],
			});

			// Create collector for button interactions
			const collector = message.createMessageComponentCollector({
				componentType: ComponentType.Button,
				time: this.COLLECTOR_TIMEOUT,
			});

			collector.on('collect', (buttonInteraction) => {
				// Update page based on button clicked
				if (buttonInteraction.customId === 'lyrics_previous') {
					currentPage = Math.max(1, currentPage - 1);
				} else if (buttonInteraction.customId === 'lyrics_next') {
					currentPage = Math.min(totalPages, currentPage + 1);
				}

				// Create new embed for current page

				const newEmbed = EmbedBuilderUtils.createLyricsEmbed(
					lyricsResult.title,
					lyricsResult.artist,
					chunks[currentPage - 1],
					lyricsResult.thumbnail,
					currentPage,
					totalPages,
				);

				// Update message with new embed and button states
				buttonInteraction
					.update({
						embeds: [newEmbed],
						components: [
							PaginationControlsComponent.create({
								currentPage,
								totalPages,
								customIds: {
									previous: 'lyrics_previous',
									next: 'lyrics_next',
								},
							}),
						],
					})
					.catch((error) => {
						this.logger.error('Failed to update lyrics page', error);
					});
			});

			collector.on('end', () => {
				// Remove buttons when collector expires
				message.edit({ components: [] }).catch(() => {
					// Message might have been deleted, ignore error
				});
			});
		} catch (error) {
			if (error instanceof LyricsNotFoundError) {
				this.logger.warn(error.message);
				const errorEmbed = EmbedBuilderUtils.createErrorEmbed(
					`${error.userMessage}\n\n**Tip:** Try searching with the exact artist and song title.`,
				);
				await interaction.editReply({ embeds: [errorEmbed] });
				return;
			}

			this.logger.error('Failed to fetch lyrics', error);

			let errorMessage = '❌ Failed to fetch lyrics. Please try again later.';

			if (error instanceof Error) {
				// Use custom error messages from LyricsService
				if (
					error.message.includes('No results found') ||
					error.message.includes('not available')
				) {
					errorMessage = `❌ ${error.message}\n\n**Tip:** Try searching with just the song name or artist name.`;
				}
			}

			const errorEmbed = EmbedBuilderUtils.createErrorEmbed(errorMessage);
			await interaction.editReply({ embeds: [errorEmbed] });
		}
	}
}
