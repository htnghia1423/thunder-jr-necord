import { DuplicateControlsComponent } from '../components/duplicate-controls.component';
import { PlaylistDuplicateAction } from '../enums/playlist-duplicate.enum';
import {
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	ComponentType,
} from 'discord.js';

export class PlaylistInteractionUtils {
	/**
	 * Wait for user button interaction and return the choice
	 */
	static async waitForUserChoice(
		interaction: ChatInputCommandInteraction,
		timeoutMs: number = 30000,
	): Promise<PlaylistDuplicateAction | null> {
		try {
			const response = await interaction.followUp({
				content: '🤔 **What would you like to do:**',
				components: [DuplicateControlsComponent.create()],
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

					void this.handleButtonClick(
						buttonInteraction,
						response,
						action,
						resolve,
					);
				});

				collector.on('end', () => {
					this.handleCollectorEnd(response, resolve);
				});
			});
		} catch {
			return null;
		}
	}

	/**
	 * Handle button click interaction
	 */
	private static async handleButtonClick(
		buttonInteraction: ButtonInteraction,
		response: Awaited<ReturnType<ChatInputCommandInteraction['followUp']>>,
		action: PlaylistDuplicateAction,
		resolve: (value: PlaylistDuplicateAction) => void,
	): Promise<void> {
		try {
			await buttonInteraction.deferUpdate();
			await this.attemptMessageDeletion(response, action, resolve);
		} catch {
			// If deferUpdate fails, still resolve
			resolve(action);
		}
	}

	/**
	 * Attempt to delete the message, fallback to disabling buttons
	 */
	private static async attemptMessageDeletion(
		response: Awaited<ReturnType<ChatInputCommandInteraction['followUp']>>,
		action: PlaylistDuplicateAction,
		resolve: (value: PlaylistDuplicateAction) => void,
	): Promise<void> {
		try {
			await response.delete();
			resolve(action);
		} catch {
			await this.fallbackToDisabledButtons(response, action, resolve);
		}
	}

	/**
	 * Fallback to disable buttons if deletion fails
	 */
	private static async fallbackToDisabledButtons(
		response: Awaited<ReturnType<ChatInputCommandInteraction['followUp']>>,
		action: PlaylistDuplicateAction,
		resolve: (value: PlaylistDuplicateAction) => void,
	): Promise<void> {
		const disabledButtons = DuplicateControlsComponent.create({
			disabled: true,
		});

		try {
			await response.edit({
				content: '✅ **Choice made!**',
				components: [disabledButtons],
			});
		} catch {
			// If edit also fails, just resolve
		} finally {
			resolve(action);
		}
	}

	/**
	 * Handle collector timeout
	 */
	private static handleCollectorEnd(
		response: Awaited<ReturnType<ChatInputCommandInteraction['followUp']>>,
		resolve: (value: PlaylistDuplicateAction | null) => void,
	): void {
		response.delete().catch(() => {
			// Ignore errors if message is already deleted
		});
		resolve(null);
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
				return `📋 **Added ${playlistText}: ${totalSongs} songs**\n⚠️ **Including ${duplicateCount} duplicates**`;

			case PlaylistDuplicateAction.NEW_ONLY:
				return `📋 **Added ${playlistText}: ${newSongsCount} new songs**\n⏭️ **Skipped ${duplicateCount} duplicates**`;

			case PlaylistDuplicateAction.CANCEL:
				return `❌ **Cancelled adding playlist**\n🔄 Current queue unchanged`;

			default:
				return `📋 **Added ${playlistText}: ${totalSongs} songs**`;
		}
	}
}
