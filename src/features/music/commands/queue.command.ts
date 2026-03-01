import { MUSIC_COMMAND_METADATA } from '../../utility/constants/command-metadata';
import { PaginationControlsComponent } from '../components/pagination-controls.component';
import { MusicConstants } from '../music.constants';
import { MusicService } from '../services/music.service';
import { EmbedBuilderUtils } from '../utils/embed-builder.utils';
import { Injectable } from '@nestjs/common';
import { ComponentType } from 'discord.js';
import { Context, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class QueueCommand {
	private static readonly SONGS_PER_PAGE = MusicConstants.SONGS_PER_PAGE;

	constructor(private readonly musicService: MusicService) {}

	@SlashCommand({
		name: MUSIC_COMMAND_METADATA.queue.name,
		description: MUSIC_COMMAND_METADATA.queue.description,
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

		// Calculate total pages (excluding current song from pagination)
		const queueSongs = queue.songs.length - 1; // Exclude current song
		const totalPages = Math.max(
			1,
			Math.ceil(queueSongs / QueueCommand.SONGS_PER_PAGE),
		);
		let currentPage = 1;

		// Create initial embed
		const initialEmbed = EmbedBuilderUtils.createQueueEmbed(
			queue,
			currentPage,
			totalPages,
		);

		// Send message with or without buttons based on queue length
		if (totalPages <= 1) {
			await interaction.editReply({ embeds: [initialEmbed] });
			return;
		}

		const message = await interaction.editReply({
			embeds: [initialEmbed],
			components: [
				PaginationControlsComponent.create({
					currentPage,
					totalPages,
				}),
			],
		});

		// Create collector for button interactions
		const collector = message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: MusicConstants.BUTTON_COLLECTOR_TIMEOUT,
		});

		collector.on('collect', (buttonInteraction) => {
			// Update page based on button clicked
			if (buttonInteraction.customId === 'previous') {
				currentPage = Math.max(1, currentPage - 1);
			} else if (buttonInteraction.customId === 'next') {
				currentPage = Math.min(totalPages, currentPage + 1);
			}

			// Create new embed for current page
			const newEmbed = EmbedBuilderUtils.createQueueEmbed(
				queue,
				currentPage,
				totalPages,
			);

			// Update message with new embed and button states
			void buttonInteraction.update({
				embeds: [newEmbed],
				components: [
					PaginationControlsComponent.create({
						currentPage,
						totalPages,
					}),
				],
			});
		});

		collector.on('end', () => {
			// Disable buttons when collector expires
			void message.edit({ components: [] }).catch(() => {
				// Message might have been deleted, ignore error
			});
		});
	}
}
