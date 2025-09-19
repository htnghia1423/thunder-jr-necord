import { PlaylistDuplicateAction } from '../enums/playlist-duplicate.enum';
import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type ChatInputCommandInteraction,
	ComponentType,
} from 'discord.js';

export class PlaylistInteractionUtils {
	/**
	 * Create action row with duplicate handling buttons
	 */
	static createDuplicateButtons(): ActionRowBuilder<ButtonBuilder> {
		const addAllButton = new ButtonBuilder()
			.setCustomId(`playlist_duplicate_${PlaylistDuplicateAction.ADD_ALL}`)
			.setLabel('🔄 Thêm tất cả')
			.setStyle(ButtonStyle.Primary);

		const newOnlyButton = new ButtonBuilder()
			.setCustomId(`playlist_duplicate_${PlaylistDuplicateAction.NEW_ONLY}`)
			.setLabel('✨ Chỉ bài mới')
			.setStyle(ButtonStyle.Success);

		const cancelButton = new ButtonBuilder()
			.setCustomId(`playlist_duplicate_${PlaylistDuplicateAction.CANCEL}`)
			.setLabel('❌ Hủy thêm')
			.setStyle(ButtonStyle.Danger);

		return new ActionRowBuilder<ButtonBuilder>().addComponents(
			addAllButton,
			newOnlyButton,
			cancelButton,
		);
	}

	/**
	 * Wait for user button interaction and return the choice
	 */
	static async waitForUserChoice(
		interaction: ChatInputCommandInteraction,
		timeoutMs: number = 30000,
	): Promise<PlaylistDuplicateAction | null> {
		try {
			const response = await interaction.followUp({
				content: '🤔 **Bạn muốn:**',
				components: [this.createDuplicateButtons()],
				ephemeral: false, // Make it visible to everyone so it can be deleted
			});

			const collector = response.createMessageComponentCollector({
				componentType: ComponentType.Button,
				time: timeoutMs,
				filter: (buttonInteraction: ButtonInteraction) =>
					buttonInteraction.user.id === interaction.user.id,
			});

			return new Promise((resolve) => {
				collector.on('collect', (buttonInteraction: ButtonInteraction) => {
					const action = buttonInteraction.customId.replace(
						'playlist_duplicate_',
						'',
					) as PlaylistDuplicateAction;

					buttonInteraction
						.deferUpdate()
						.then(() => {
							// First try to delete the interaction message
							response
								.delete()
								.then(() => {
									resolve(action);
								})
								.catch(() => {
									// If delete fails, disable buttons instead
									const disabledButtons = this.createDuplicateButtons();
									disabledButtons.components.forEach((button) => {
										button.setDisabled(true);
									});

									response
										.edit({
											content: '✅ **Đã chọn xong!**',
											components: [disabledButtons],
										})
										.catch(() => {
											// If edit also fails, just resolve
										})
										.finally(() => {
											resolve(action);
										});
								});
						})
						.catch(() => {
							// If deferUpdate fails, still resolve
							resolve(action);
						});
				});

				collector.on('end', () => {
					// Clean up on timeout
					response.delete().catch(() => {
						// Ignore errors if message is already deleted
					});
					resolve(null);
				});
			});
		} catch {
			return null;
		}
	}

	/**
	 * Generate final result message based on user choice
	 */
	static generateResultMessage(
		action: PlaylistDuplicateAction,
		totalSongs: number,
		duplicateCount: number,
		newSongsCount: number,
		playlistName?: string,
	): string {
		const playlistText = playlistName ? `**${playlistName}**` : 'playlist';

		switch (action) {
			case PlaylistDuplicateAction.ADD_ALL:
				return `📋 **Đã thêm ${playlistText}: ${totalSongs} bài hát**\n⚠️ **Bao gồm ${duplicateCount} bài trùng**`;

			case PlaylistDuplicateAction.NEW_ONLY:
				return `📋 **Đã thêm ${playlistText}: ${newSongsCount} bài mới**\n⏭️ **Đã bỏ qua ${duplicateCount} bài trùng**`;

			case PlaylistDuplicateAction.CANCEL:
				return `❌ **Đã hủy thêm playlist**\n🔄 Queue hiện tại không thay đổi`;

			default:
				return `📋 **Đã thêm ${playlistText}: ${totalSongs} bài hát**`;
		}
	}
}
