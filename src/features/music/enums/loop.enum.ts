/**
 * Enum for loop modes
 */
export enum LoopMode {
	OFF = 0, // No loop
	SONG = 1, // Loop current song
	QUEUE = 2, // Loop entire queue
}

/**
 * Human readable loop mode names
 */
export const LoopModeNames = {
	[LoopMode.OFF]: 'Tắt lặp',
	[LoopMode.SONG]: 'Lặp bài hát',
	[LoopMode.QUEUE]: 'Lặp queue',
};
