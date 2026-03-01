import { PlaylistDuplicateAction } from '../enums/playlist-duplicate.enum';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Options for customizing duplicate control buttons
 */
export interface DuplicateControlsOptions {
	/** Force all buttons to be disabled (e.g., after user selection) */
	disabled?: boolean;
}

/**
 * Stateless component factory for playlist duplicate handling buttons
 * Creates an ActionRow with 3 buttons: Add All, New Only, Cancel
 */
export class DuplicateControlsComponent {
	/**
	 * Create duplicate handling control buttons ActionRow
	 * @param options - Configuration for button states
	 * @returns ActionRow with 3 duplicate handling buttons
	 */
	static create(
		options: DuplicateControlsOptions = {},
	): ActionRowBuilder<ButtonBuilder> {
		const { disabled = false } = options;

		const addAllButton = new ButtonBuilder()
			.setCustomId(`playlist_duplicate_${PlaylistDuplicateAction.ADD_ALL}`)
			.setLabel('🔄 Add All')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(disabled);

		const newOnlyButton = new ButtonBuilder()
			.setCustomId(`playlist_duplicate_${PlaylistDuplicateAction.NEW_ONLY}`)
			.setLabel('✨ New Only')
			.setStyle(ButtonStyle.Success)
			.setDisabled(disabled);

		const cancelButton = new ButtonBuilder()
			.setCustomId(`playlist_duplicate_${PlaylistDuplicateAction.CANCEL}`)
			.setLabel('❌ Cancel')
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled);

		return new ActionRowBuilder<ButtonBuilder>().addComponents(
			addAllButton,
			newOnlyButton,
			cancelButton,
		);
	}
}
