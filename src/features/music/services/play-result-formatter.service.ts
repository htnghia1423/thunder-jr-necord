import { MusicResponse } from '../enums/music.enum';
import {
	ExtendedQueue,
	ExtendedSong,
	toSong,
	toSongArray,
} from '../interfaces/distube-types.interface';
import { PlayResult } from '../interfaces/music.interface';
import { DuplicateUtils } from '../utils/duplicate.utils';
import { Injectable, Logger } from '@nestjs/common';

/**
 * PlayResultFormatterService handles creation of PlayResult objects
 * Separated for Single Responsibility Principle
 */
@Injectable()
export class PlayResultFormatterService {
	private readonly logger = new Logger(PlayResultFormatterService.name);

	/**
	 * Create a successful play result
	 */
	createSuccessResult(
		currentSong: ExtendedSong | undefined,
		wasQueueEmpty: boolean,
		isPlaylist: boolean,
		songsAdded: number,
		originalQueueLength: number,
		duplicateWarning: string,
	): PlayResult {
		return {
			success: true,
			message: MusicResponse.SONG_ADDED,
			data: {
				songName: currentSong?.name,
				duration: currentSong?.formattedDuration,
				isNowPlaying: wasQueueEmpty,
				wasQueueEmpty,
				isPlaylist,
				songsAdded,
				queuePosition: wasQueueEmpty ? 0 : originalQueueLength - 1,
				duplicateWarning,
			},
		};
	}

	/**
	 * Create a failed play result
	 */
	createErrorResult(message: string): PlayResult {
		return {
			success: false,
			message,
		};
	}

	/**
	 * Get duplicate warning for single songs
	 */
	getSingleSongDuplicateWarning(
		isPlaylist: boolean,
		wasQueueEmpty: boolean,
		finalQueue: ExtendedQueue | null,
		originalQueueLength: number,
		currentSong: ExtendedSong | undefined,
	): string {
		if (isPlaylist) {
			return '';
		}

		const songsToCheck = wasQueueEmpty
			? []
			: finalQueue?.songs.slice(0, originalQueueLength) || [];

		if (songsToCheck.length === 0 || !currentSong) {
			return '';
		}

		const duplicateCheck = DuplicateUtils.checkDuplicate(
			toSong(currentSong),
			toSongArray(songsToCheck),
		);

		if (
			duplicateCheck.isDuplicate &&
			currentSong?.name &&
			duplicateCheck.position &&
			duplicateCheck.matchType
		) {
			return `\n\n${DuplicateUtils.generateDuplicateWarning(
				currentSong.name,
				duplicateCheck.position,
				duplicateCheck.matchType,
			)}`;
		}

		return '';
	}
}
