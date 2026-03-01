import { MUSIC_COMMAND_METADATA } from '../../utility/constants/command-metadata';
import { MusicService } from '../services/music.service';
import { EmbedBuilderUtils } from '../utils/embed-builder.utils';
import { Injectable } from '@nestjs/common';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
} from 'discord.js';
import { Context, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class QueueCommand {
	private static readonly SONGS_PER_PAGE = 10;

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

		// Create pagination buttons
		const createButtons = (page: number): ActionRowBuilder<ButtonBuilder> => {
			return new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId('previous')
					.setLabel('◀️ Previous')
					.setStyle(ButtonStyle.Primary)
					.setDisabled(page === 1),
				new ButtonBuilder()
					.setCustomId('next')
					.setLabel('Next ▶️')
					.setStyle(ButtonStyle.Primary)
					.setDisabled(page === totalPages),
			);
		};

		const message = await interaction.editReply({
			embeds: [initialEmbed],
			components: [createButtons(currentPage)],
		});

		// Create collector for button interactions
		const collector = message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 300000, // 5 minutes
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
				components: [createButtons(currentPage)],
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
