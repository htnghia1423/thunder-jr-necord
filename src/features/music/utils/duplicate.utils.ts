import { Song } from 'distube';

/**
 * Type representing the different ways songs can match
 */
type MatchType = 'url' | 'name' | 'both';

/**
 * Type representing the result of a duplicate check
 */
type DuplicateCheckResult = {
	isDuplicate: boolean;
	position?: number;
	matchType?: MatchType;
};

/**
 * Type representing a duplicate song entry
 */
type DuplicateSongEntry = {
	song: Song;
	existingPosition: number;
	matchType: MatchType;
};

/**
 * Type representing the result of playlist duplicate analysis
 */
type PlaylistDuplicateResult = {
	totalSongs: number;
	duplicates: Array<DuplicateSongEntry>;
	newSongs: Song[];
	duplicateCount: number;
};

export class DuplicateUtils {
	/**
	 * Check if a song already exists in the queue
	 * @param newSong Song to check
	 * @param existingQueue Current queue
	 * @returns Object with duplicate info
	 */
	static checkDuplicate(
		newSong: Song,
		existingQueue: Song[],
	): DuplicateCheckResult {
		if (!existingQueue?.length) {
			return { isDuplicate: false };
		}

		for (let i = 0; i < existingQueue.length; i++) {
			const existingSong = existingQueue[i];

			// Check URL match (most reliable)
			const urlMatch = newSong.url === existingSong.url;

			// Check name + uploader match (for different URLs of same song)
			const nameMatch =
				newSong.name?.toLowerCase().trim() ===
					existingSong.name?.toLowerCase().trim() &&
				newSong.uploader?.name?.toLowerCase().trim() ===
					existingSong.uploader?.name?.toLowerCase().trim();

			if (urlMatch && nameMatch) {
				return {
					isDuplicate: true,
					position: i + 1, // 1-based position for user display
					matchType: 'both',
				};
			} else if (urlMatch) {
				return {
					isDuplicate: true,
					position: i + 1,
					matchType: 'url',
				};
			} else if (nameMatch) {
				return {
					isDuplicate: true,
					position: i + 1,
					matchType: 'name',
				};
			}
		}

		return { isDuplicate: false };
	}

	/**
	 * Generate duplicate warning message
	 */
	static generateDuplicateWarning(
		songName: string,
		position: number,
		matchType: MatchType,
	): string {
		const matchTypeText = {
			url: '(same URL)',
			name: '(same name + artist)',
			both: '(exact match)',
		};

		return `⚠️ **This song is already in queue**\n📍 Current position: #${position} ${matchTypeText[matchType]}`;
	}

	/**
	 * Check for duplicates in a playlist
	 */
	static checkPlaylistDuplicates(
		newSongs: Song[],
		existingQueue: Song[],
	): PlaylistDuplicateResult {
		const duplicates: Array<DuplicateSongEntry> = [];
		const uniqueSongs: Song[] = [];

		for (const newSong of newSongs) {
			const duplicateCheck = this.checkDuplicate(newSong, existingQueue);

			if (duplicateCheck.isDuplicate) {
				duplicates.push({
					song: newSong,
					existingPosition: duplicateCheck.position!,
					matchType: duplicateCheck.matchType!,
				});
			} else {
				uniqueSongs.push(newSong);
			}
		}

		return {
			totalSongs: newSongs.length,
			duplicates,
			newSongs: uniqueSongs,
			duplicateCount: duplicates.length,
		};
	}

	/**
	 * Generate playlist duplicate summary message
	 */
	static generatePlaylistDuplicateMessage(
		totalSongs: number,
		duplicateCount: number,
		duplicates: Array<DuplicateSongEntry>,
	): string {
		const percentage = Math.round((duplicateCount / totalSongs) * 100);

		let message = `📋 **Playlist contains ${duplicateCount} duplicates out of ${totalSongs} songs** (${percentage}%)\n\n`;

		// Show first 3 duplicates as examples
		const samplesToShow = Math.min(3, duplicates.length);
		if (samplesToShow > 0) {
			message += `**Duplicate examples:**\n`;
			for (let i = 0; i < samplesToShow; i++) {
				const dup = duplicates[i];
				const songName = dup.song.name || 'Unknown';
				message += `• ${songName} (already at #${dup.existingPosition})\n`;
			}

			if (duplicates.length > 3) {
				message += `• ... and ${duplicates.length - 3} more\n`;
			}
		}

		return message;
	}
}
