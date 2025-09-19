import { Song } from 'distube';

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
	): {
		isDuplicate: boolean;
		position?: number;
		matchType?: 'url' | 'name' | 'both';
	} {
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
		matchType: 'url' | 'name' | 'both',
	): string {
		const matchTypeText = {
			url: '(cùng URL)',
			name: '(cùng tên + nghệ sĩ)',
			both: '(hoàn toàn trùng khớp)',
		};

		return `⚠️ **Bài này đã có trong queue**\n📍 Vị trí hiện tại: #${position} ${matchTypeText[matchType]}`;
	}

	/**
	 * Check for duplicates in a playlist
	 */
	static checkPlaylistDuplicates(
		newSongs: Song[],
		existingQueue: Song[],
	): {
		totalSongs: number;
		duplicates: Array<{
			song: Song;
			existingPosition: number;
			matchType: 'url' | 'name' | 'both';
		}>;
		newSongs: Song[];
		duplicateCount: number;
	} {
		const duplicates: Array<{
			song: Song;
			existingPosition: number;
			matchType: 'url' | 'name' | 'both';
		}> = [];
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
		duplicates: Array<{
			song: Song;
			existingPosition: number;
			matchType: 'url' | 'name' | 'both';
		}>,
	): string {
		const percentage = Math.round((duplicateCount / totalSongs) * 100);

		let message = `📋 **Phát hiện playlist có ${duplicateCount} bài trùng trong ${totalSongs} bài** (${percentage}%)\n\n`;

		// Show first 3 duplicates as examples
		const samplesToShow = Math.min(3, duplicates.length);
		if (samplesToShow > 0) {
			message += `**Ví dụ bài trùng:**\n`;
			for (let i = 0; i < samplesToShow; i++) {
				const dup = duplicates[i];
				const songName = dup.song.name || 'Unknown';
				message += `• ${songName} (đã có ở #${dup.existingPosition})\n`;
			}

			if (duplicates.length > 3) {
				message += `• ... và ${duplicates.length - 3} bài khác\n`;
			}
		}

		return message;
	}
}
