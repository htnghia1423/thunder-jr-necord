/**
 * Centralized constants for the music module
 * Eliminates magic numbers and provides type safety
 */
export const MusicConstants = {
	// Queue & Pagination
	SONGS_PER_PAGE: 10,
	QUEUE_DISPLAY_LIMIT: 10,

	// Timeouts
	EMPTY_CHANNEL_TIMEOUT: 60000, // 60 seconds in milliseconds
	BUTTON_COLLECTOR_TIMEOUT: 300000, // 5 minutes in milliseconds

	// Progress Bar
	PROGRESS_BAR_LENGTH: 20,
	PROGRESS_BAR_FILLED_CHAR: '█',
	PROGRESS_BAR_EMPTY_CHAR: '░',

	// Embed Colors
	COLOR_SUCCESS: 0x00ff00, // Green
	COLOR_INFO: 0x0099ff, // Blue
	COLOR_QUEUE: 0x9b59b6, // Purple
	COLOR_ERROR: 0xff0000, // Red

	// YouTube
	YOUTUBE_API_BATCH_SIZE: 50,
	YOUTUBE_PLAYLIST_REGEX:
		/^https?:\/\/(www\.)?youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/,
	YOUTUBE_MIX_REGEX: /[&?]list=(RD[a-zA-Z0-9_-]+|RDMM[a-zA-Z0-9_-]+)/,

	// Duplicate Detection
	DUPLICATE_THRESHOLD: 0.1, // 10% threshold

	// Default Values
	DEFAULT_UPLOADER_NAME: 'Unknown',
	DEFAULT_PROGRESS_PERCENTAGE: 0,
} as const;

export type MusicConstants = typeof MusicConstants;
