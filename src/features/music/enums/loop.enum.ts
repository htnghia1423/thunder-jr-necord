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
	[LoopMode.OFF]: 'Loop Off',
	[LoopMode.SONG]: 'Loop Song',
	[LoopMode.QUEUE]: 'Loop Queue',
};
