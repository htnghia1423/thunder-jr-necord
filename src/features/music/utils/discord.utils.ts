/**
 * Utility functions for Discord message formatting
 */
export class DiscordUtils {
	/**
	 * Escape Discord markdown characters to prevent formatting issues
	 */
	static escapeMarkdown(text: string): string {
		return text.replace(/([*_~`|\\])/g, '\\$1');
	}

	/**
	 * Format song name safely for Discord
	 */
	static formatSongName(songName: string): string {
		return this.escapeMarkdown(songName);
	}

	/**
	 * Format user mention safely
	 */
	static formatUser(user: any): string {
		if (!user) return 'Unknown';

		try {
			// If it's a Discord User object
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (user.displayName || user.username) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
				const name = user.displayName || user.username;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				return this.escapeMarkdown(name);
			}

			// If it's already a string
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
			return this.escapeMarkdown(user.toString());
		} catch {
			return 'Unknown';
		}
	}

	/**
	 * Truncate text if it's too long for Discord
	 */
	static truncateText(text: string, maxLength: number = 100): string {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength - 3) + '...';
	}

	/**
	 * Format duration safely
	 */
	static formatDuration(duration: string): string {
		return this.escapeMarkdown(duration);
	}
}
