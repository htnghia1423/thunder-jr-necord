import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Options for customizing pagination control buttons
 */
export interface PaginationControlsOptions {
	/** Current page number (1-indexed) */
	currentPage: number;
	/** Total number of pages */
	totalPages: number;
	/** Optional custom IDs for the buttons (defaults to 'previous' and 'next') */
	customIds?: {
		previous?: string;
		next?: string;
	};
}

/**
 * Stateless component factory for pagination control buttons
 * Creates an ActionRow with 2 buttons: Previous, Next
 */
export class PaginationControlsComponent {
	/**
	 * Create pagination control buttons ActionRow
	 * @param options - Configuration for pagination state
	 * @returns ActionRow with 2 pagination buttons
	 */
	static create(
		options: PaginationControlsOptions,
	): ActionRowBuilder<ButtonBuilder> {
		const {
			currentPage,
			totalPages,
			customIds = { previous: 'previous', next: 'next' },
		} = options;

		return new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(customIds.previous || 'previous')
				.setLabel('◀️ Previous')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(currentPage === 1),
			new ButtonBuilder()
				.setCustomId(customIds.next || 'next')
				.setLabel('Next ▶️')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(currentPage === totalPages),
		);
	}
}
