import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Options for customizing playback control buttons
 */
export interface PlaybackControlsOptions {
	/** Whether the queue is currently paused */
	isPaused?: boolean;
	/** Whether there are previous songs in queue history */
	hasPreviousSongs?: boolean;
	/** Whether there are next songs in the queue */
	hasNextSongs?: boolean;
	/** Force all buttons to be disabled (e.g., after collector timeout) */
	disabled?: boolean;
	/** Whether to include the lyrics action row */
	includeLyrics?: boolean;
}

/**
 * Stateless component factory for playback control buttons
 * Creates an ActionRow with 5 buttons: Previous, Play/Pause, Stop, Skip, Loop
 */
export class PlaybackControlsComponent {
	/**
	 * Create playback control buttons ActionRow
	 * @param options - Configuration for button states
	 * @returns ActionRow with 5 playback control buttons
	 */
	static create(
		options: PlaybackControlsOptions = {},
	): ActionRowBuilder<ButtonBuilder> {
		const {
			isPaused = false,
			hasPreviousSongs = false,
			hasNextSongs = true,
			disabled = false,
		} = options;

		return new ActionRowBuilder<ButtonBuilder>().addComponents(
			// Previous button - disabled if no previous song
			new ButtonBuilder()
				.setCustomId('music_prev')
				.setEmoji('⏮️')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(disabled || !hasPreviousSongs),

			// Play/Pause button - changes based on paused state
			new ButtonBuilder()
				.setCustomId('music_play_pause')
				.setEmoji(isPaused ? '▶️' : '⏸️')
				.setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary)
				.setDisabled(disabled),

			// Stop button
			new ButtonBuilder()
				.setCustomId('music_stop')
				.setEmoji('⏹️')
				.setStyle(ButtonStyle.Danger)
				.setDisabled(disabled),

			// Skip button - disabled if no next song
			new ButtonBuilder()
				.setCustomId('music_skip')
				.setEmoji('⏭️')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(disabled || !hasNextSongs),

			// Loop button - changes based on repeat mode
			new ButtonBuilder()
				.setCustomId('music_loop')
				.setEmoji('🔁')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(disabled),
		);
	}

	/**
	 * Create playback controls plus optional secondary action rows.
	 */
	static createRows(
		options: PlaybackControlsOptions = {},
	): ActionRowBuilder<ButtonBuilder>[] {
		const { disabled = false, includeLyrics = true } = options;
		const rows = [this.create(options)];

		if (includeLyrics) {
			rows.push(
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId('music_lyrics')
						.setLabel('Lyrics')
						.setStyle(ButtonStyle.Secondary)
						.setDisabled(disabled),
				),
			);
		}

		return rows;
	}
}
